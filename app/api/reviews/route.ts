import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

const BUCKET = "visit-review-images";
const MAX_IMAGES = 5;
const MAX_FILE_SIZE = 10 * 1024 * 1024;

function one<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function maskName(name: string | null | undefined) {
  const value = String(name ?? "보호자").trim();
  if (value.length <= 1) return `${value || "보"}○`;
  if (value.length === 2) return `${value[0]}○`;
  return `${value[0]}${"○".repeat(Math.max(1, value.length - 2))}${value.at(-1)}`;
}

async function getUser(request: NextRequest) {
  const authorization = request.headers.get("authorization") ?? "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (!token) return null;
  const { data: { user } } = await supabaseAdmin.auth.getUser(token);
  return user ?? null;
}

function publicUrl(path: string) {
  return supabaseAdmin.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const hospitalId = Number(url.searchParams.get("hospitalId"));
  const user = await getUser(request);

  if (!Number.isInteger(hospitalId)) {
    return NextResponse.json({ message: "병원 정보가 올바르지 않습니다." }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("hospital_visit_reviews")
    .select(`
      id,hospital_id,reservation_id,guardian_user_id,pet_id,visit_date,title,content,image_paths,
      hospital_reply,hospital_replied_at,created_at,updated_at,
      pets(name,species),reservations(guardian_name)
    `)
    .eq("hospital_id", hospitalId)
    .eq("status", "published")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ message: error.message }, { status: 500 });

  let eligibleReservations: any[] = [];
  let myReviews: number[] = [];

  if (user) {
    const [{ data: completed }, { data: mine }] = await Promise.all([
      supabaseAdmin
        .from("reservations")
        .select("id,pet_id,reservation_date,pets(name,species)")
        .eq("hospital_id", hospitalId)
        .eq("user_id", user.id)
        .eq("status", "completed")
        .order("reservation_date", { ascending: false }),
      supabaseAdmin
        .from("hospital_visit_reviews")
        .select("reservation_id")
        .eq("guardian_user_id", user.id)
        .neq("status", "deleted"),
    ]);
    myReviews = (mine ?? []).map((row: any) => Number(row.reservation_id));
    eligibleReservations = (completed ?? []).filter((row: any) => !myReviews.includes(Number(row.id)));
  }

  const reviews = (data ?? []).map((row: any) => {
    const pet = one<any>(row.pets);
    const reservation = one<any>(row.reservations);
    return {
      id: row.id,
      reservationId: row.reservation_id,
      petId: row.pet_id,
      petName: pet?.name ?? "반려동물",
      petSpecies: pet?.species ?? null,
      guardianName: maskName(reservation?.guardian_name),
      visitDate: row.visit_date,
      title: row.title,
      content: row.content,
      imageUrls: (row.image_paths ?? []).map(publicUrl),
      hospitalReply: row.hospital_reply,
      hospitalRepliedAt: row.hospital_replied_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      isMine: Boolean(user && row.guardian_user_id === user.id),
    };
  });

  return NextResponse.json({ reviews, eligibleReservations });
}

export async function POST(request: NextRequest) {
  const user = await getUser(request);
  if (!user) return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });

  const form = await request.formData();
  const reservationId = Number(form.get("reservationId"));
  const title = String(form.get("title") ?? "").trim() || null;
  const content = String(form.get("content") ?? "").trim();
  const files = form.getAll("images").filter((item): item is File => item instanceof File && item.size > 0);

  if (!Number.isInteger(reservationId)) return NextResponse.json({ message: "방문 기록을 선택해 주세요." }, { status: 400 });
  if (content.length < 5 || content.length > 3000) return NextResponse.json({ message: "후기는 5자 이상 3000자 이하로 작성해 주세요." }, { status: 400 });
  if (files.length > MAX_IMAGES) return NextResponse.json({ message: `사진은 최대 ${MAX_IMAGES}장까지 등록할 수 있습니다.` }, { status: 400 });

  const { data: reservation, error: reservationError } = await supabaseAdmin
    .from("reservations")
    .select("id,hospital_id,user_id,pet_id,reservation_date,status")
    .eq("id", reservationId)
    .eq("user_id", user.id)
    .eq("status", "completed")
    .maybeSingle();

  if (reservationError) return NextResponse.json({ message: reservationError.message }, { status: 500 });
  if (!reservation) return NextResponse.json({ message: "진료가 완료된 본인의 방문 기록만 후기를 남길 수 있습니다." }, { status: 403 });

  const uploadedPaths: string[] = [];
  try {
    for (const [index, file] of files.entries()) {
      if (!file.type.startsWith("image/") || file.size > MAX_FILE_SIZE) throw new Error("사진 파일은 장당 10MB 이하의 이미지여야 합니다.");
      const extension = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
      const path = `${user.id}/${reservation.id}/${Date.now()}-${index}.${extension}`;
      const bytes = new Uint8Array(await file.arrayBuffer());
      const { error } = await supabaseAdmin.storage.from(BUCKET).upload(path, bytes, { contentType: file.type, upsert: false });
      if (error) throw new Error(error.message);
      uploadedPaths.push(path);
    }

    const { data, error } = await supabaseAdmin
      .from("hospital_visit_reviews")
      .insert({
        hospital_id: reservation.hospital_id,
        reservation_id: reservation.id,
        guardian_user_id: user.id,
        pet_id: reservation.pet_id,
        visit_date: reservation.reservation_date,
        title,
        content,
        image_paths: uploadedPaths,
      })
      .select("id")
      .single();

    if (error) throw new Error(error.code === "23505" ? "이미 이 방문에 대한 후기를 작성했습니다." : error.message);
    return NextResponse.json({ reviewId: data.id, message: "방문 후기가 등록되었습니다." }, { status: 201 });
  } catch (error) {
    if (uploadedPaths.length) await supabaseAdmin.storage.from(BUCKET).remove(uploadedPaths);
    return NextResponse.json({ message: error instanceof Error ? error.message : "후기 등록에 실패했습니다." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const user = await getUser(request);
  if (!user) return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  const body = await request.json();
  const reviewId = Number(body.reviewId);
  const content = String(body.content ?? "").trim();
  const title = String(body.title ?? "").trim() || null;
  if (!Number.isInteger(reviewId) || content.length < 5 || content.length > 3000) return NextResponse.json({ message: "수정할 후기 내용을 확인해 주세요." }, { status: 400 });
  const { error } = await supabaseAdmin.from("hospital_visit_reviews").update({ title, content, updated_at: new Date().toISOString() }).eq("id", reviewId).eq("guardian_user_id", user.id).eq("status", "published");
  if (error) return NextResponse.json({ message: error.message }, { status: 500 });
  return NextResponse.json({ message: "후기가 수정되었습니다." });
}

export async function DELETE(request: NextRequest) {
  const user = await getUser(request);
  if (!user) return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  const reviewId = Number(new URL(request.url).searchParams.get("reviewId"));
  if (!Number.isInteger(reviewId)) return NextResponse.json({ message: "후기 정보가 올바르지 않습니다." }, { status: 400 });
  const { error } = await supabaseAdmin.from("hospital_visit_reviews").update({ status: "deleted", updated_at: new Date().toISOString() }).eq("id", reviewId).eq("guardian_user_id", user.id);
  if (error) return NextResponse.json({ message: error.message }, { status: 500 });
  return NextResponse.json({ message: "후기가 삭제되었습니다." });
}
