import { NextResponse } from "next/server";
import { requireLabAccess } from "../../../../../lib/v6-4-lab-access";

export async function GET(request: Request) {
  const auth = await requireLabAccess(request, "view_lab");
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  const url = new URL(request.url);
  const petId = Number(url.searchParams.get("petId"));
  const status = url.searchParams.get("status");

  let query = auth.supabaseAdmin
    .from("lab_orders")
    .select(`
      id, hospital_id, pet_id, emr_record_id, reservation_id,
      category, test_name, status, priority, requested_at,
      collected_at, completed_at, finalized_at,
      guardian_visible, guardian_summary, created_at,
      pets(id, name, species, breed),
      profiles!lab_orders_requested_by_fkey(display_name)
    `)
    .eq("hospital_id", auth.access.hospitalId)
    .order("created_at", { ascending: false })
    .limit(200);

  if (Number.isInteger(petId)) query = query.eq("pet_id", petId);
  if (status) query = query.eq("status", status);

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, orders: data ?? [] });
}

export async function POST(request: Request) {
  const auth = await requireLabAccess(request, "write_lab");
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  const body = await request.json();
  const petId = Number(body.petId);
  const testName = String(body.testName ?? "").trim();
  const category = String(body.category ?? "").trim();

  if (!Number.isInteger(petId) || !testName || !category) {
    return NextResponse.json(
      { ok: false, message: "환자, 검사 분류, 검사명을 확인해 주세요." },
      { status: 400 },
    );
  }

  const { data: pet } = await auth.supabaseAdmin
    .from("pets")
    .select("id")
    .eq("id", petId)
    .maybeSingle();

  if (!pet) {
    return NextResponse.json({ ok: false, message: "환자를 찾지 못했습니다." }, { status: 404 });
  }

  if (body.emrRecordId) {
    const { data: emr } = await auth.supabaseAdmin
      .from("emr_records")
      .select("id")
      .eq("id", Number(body.emrRecordId))
      .eq("hospital_id", auth.access.hospitalId)
      .eq("pet_id", petId)
      .maybeSingle();

    if (!emr) {
      return NextResponse.json(
        { ok: false, message: "전자차트와 환자 정보가 일치하지 않습니다." },
        { status: 400 },
      );
    }
  }

  const { data, error } = await auth.supabaseAdmin
    .from("lab_orders")
    .insert({
      hospital_id: auth.access.hospitalId,
      pet_id: petId,
      emr_record_id: body.emrRecordId ? Number(body.emrRecordId) : null,
      reservation_id: body.reservationId ? Number(body.reservationId) : null,
      category,
      test_name: testName,
      status: "ordered",
      priority: ["routine", "urgent", "stat"].includes(String(body.priority))
        ? body.priority
        : "routine",
      specimen_type: String(body.specimenType ?? "").trim() || null,
      clinical_note: String(body.clinicalNote ?? "").trim() || null,
      requested_by: auth.user.id,
      created_by: auth.user.id,
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, orderId: data.id });
}
