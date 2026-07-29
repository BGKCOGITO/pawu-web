import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireHospitalContext } from "@/lib/hospital-api-auth";

const BUCKET = "hospitalization-guardian-media";
const categories = new Set(["general", "meal", "medication", "condition", "procedure", "discharge"]);

async function getHospitalization(hospitalizationId: number, hospitalId: number) {
  return supabaseAdmin
    .from("hospitalizations")
    .select(`
      id,
      hospital_id,
      reservation_id,
      hospital_patient_id,
      hospital_patients(
        pet_id,
        pets(id, user_id)
      ),
      reservations(id, user_id)
    `)
    .eq("id", hospitalizationId)
    .eq("hospital_id", hospitalId)
    .maybeSingle();
}

function one(value: any) {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

async function attachSignedImage<T extends { image_storage_path?: string | null; image_url?: string | null }>(item: T) {
  if (!item.image_storage_path) return item;
  const { data } = await supabaseAdmin.storage.from(BUCKET).createSignedUrl(item.image_storage_path, 60 * 60);
  return { ...item, image_url: data?.signedUrl ?? null };
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ hospitalizationId: string }> }) {
  const context = await requireHospitalContext(request);
  if ("error" in context) return NextResponse.json({ message: context.error }, { status: context.status });

  const { hospitalizationId: rawId } = await params;
  const hospitalizationId = Number(rawId);
  if (!Number.isInteger(hospitalizationId)) return NextResponse.json({ message: "입원 기록 번호가 올바르지 않습니다." }, { status: 400 });

  const { data: hospitalization, error: hospitalizationError } = await getHospitalization(hospitalizationId, context.hospitalId);
  if (hospitalizationError) return NextResponse.json({ message: hospitalizationError.message }, { status: 500 });
  if (!hospitalization) return NextResponse.json({ message: "입원 기록을 찾을 수 없습니다." }, { status: 404 });

  const { data, error } = await supabaseAdmin
    .from("hospitalization_guardian_updates")
    .select("*")
    .eq("hospitalization_id", hospitalizationId)
    .order("published_at", { ascending: false });

  if (error) return NextResponse.json({ message: error.message }, { status: 500 });
  const updates = await Promise.all((data ?? []).map(attachSignedImage));
  return NextResponse.json({ updates });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ hospitalizationId: string }> }) {
  const context = await requireHospitalContext(request);
  if ("error" in context) return NextResponse.json({ message: context.error }, { status: context.status });

  const { hospitalizationId: rawId } = await params;
  const hospitalizationId = Number(rawId);
  if (!Number.isInteger(hospitalizationId)) return NextResponse.json({ message: "입원 기록 번호가 올바르지 않습니다." }, { status: 400 });

  const { data: hospitalization, error: hospitalizationError } = await getHospitalization(hospitalizationId, context.hospitalId);
  if (hospitalizationError) return NextResponse.json({ message: hospitalizationError.message }, { status: 500 });
  if (!hospitalization) return NextResponse.json({ message: "입원 기록을 찾을 수 없습니다." }, { status: 404 });

  const body = await request.json() as { category?: string; title?: string; message?: string; imageUrl?: string | null; imageStoragePath?: string | null };
  const category = String(body.category ?? "general");
  const title = String(body.title ?? "").trim();
  const message = String(body.message ?? "").trim();
  const imageUrl = String(body.imageUrl ?? "").trim() || null;
  const imageStoragePath = String(body.imageStoragePath ?? "").trim() || null;

  if (!categories.has(category)) return NextResponse.json({ message: "공유 종류가 올바르지 않습니다." }, { status: 400 });
  if (!title || !message) return NextResponse.json({ message: "제목과 보호자 안내 내용을 입력해 주세요." }, { status: 400 });
  if (title.length > 100) return NextResponse.json({ message: "제목은 100자 이내로 입력해 주세요." }, { status: 400 });
  if (message.length > 2000) return NextResponse.json({ message: "안내 내용은 2,000자 이내로 입력해 주세요." }, { status: 400 });
  if (imageStoragePath && !imageStoragePath.startsWith(`${context.hospitalId}/${hospitalizationId}/`)) {
    return NextResponse.json({ message: "첨부 사진 경로가 올바르지 않습니다." }, { status: 400 });
  }

  const patient = one(hospitalization.hospital_patients);
  const pet = one(patient?.pets);
  const reservation = one(hospitalization.reservations);
  const guardianUserId = reservation?.user_id ?? pet?.user_id ?? null;

  if (!guardianUserId) {
    return NextResponse.json({ message: "연결된 보호자 계정을 찾을 수 없습니다. 예약 또는 반려동물 소유자 정보를 확인해 주세요." }, { status: 400 });
  }

  const publishedAt = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from("hospitalization_guardian_updates")
    .insert({
      hospital_id: context.hospitalId,
      hospitalization_id: hospitalizationId,
      pet_id: pet?.id ?? patient?.pet_id ?? null,
      guardian_user_id: guardianUserId,
      category,
      title,
      message,
      image_url: imageUrl,
      image_storage_path: imageStoragePath,
      published_at: publishedAt,
      created_by: context.user.id,
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ message: error.message }, { status: 500 });

  await supabaseAdmin.from("hospitalization_events").insert({
    hospitalization_id: hospitalizationId,
    event_type: "guardian_update",
    occurred_at: publishedAt,
    title,
    content: message,
    is_guardian_visible: true,
    guardian_message: message,
    created_by: context.user.id,
  });

  await supabaseAdmin.from("inpatient_surgery_audit_logs").insert({
    hospital_id: context.hospitalId,
    hospitalization_id: hospitalizationId,
    actor_user_id: context.user.id,
    action: "guardian_update_published",
    after_data: data,
  });

  return NextResponse.json({ update: await attachSignedImage(data), message: "보호자에게 입원 경과를 실시간 공유했습니다." });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ hospitalizationId: string }> }) {
  const context = await requireHospitalContext(request);
  if ("error" in context) return NextResponse.json({ message: context.error }, { status: context.status });

  const { hospitalizationId: rawId } = await params;
  const hospitalizationId = Number(rawId);
  const updateId = Number(new URL(request.url).searchParams.get("updateId"));
  if (!Number.isInteger(hospitalizationId) || !Number.isInteger(updateId)) return NextResponse.json({ message: "요청 값이 올바르지 않습니다." }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from("hospitalization_guardian_updates")
    .update({ retracted_at: new Date().toISOString() })
    .eq("id", updateId)
    .eq("hospitalization_id", hospitalizationId)
    .eq("hospital_id", context.hospitalId)
    .is("retracted_at", null)
    .select("id")
    .maybeSingle();

  if (error) return NextResponse.json({ message: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ message: "공개 중인 경과 기록을 찾을 수 없습니다." }, { status: 404 });
  return NextResponse.json({ message: "보호자 공개가 철회되었습니다." });
}
