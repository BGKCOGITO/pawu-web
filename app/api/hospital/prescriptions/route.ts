import { NextResponse } from "next/server";
import { requirePrescriptionAccess } from "../../../../lib/v6-5-prescription-access";

export async function GET(request: Request) {
  const auth = await requirePrescriptionAccess(request, "view_prescription");

  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, message: auth.message },
      { status: auth.status },
    );
  }

  const url = new URL(request.url);
  const petId = Number(url.searchParams.get("petId"));
  const status = url.searchParams.get("status");

  let query = auth.supabaseAdmin
    .from("medication_orders")
    .select(`
      id, hospital_id, pet_id, emr_record_id, reservation_id,
      status, diagnosis_summary, guardian_note,
      start_date, end_date, finalized_at, created_at,
      pets(id, name, species, breed),
      medication_order_items(id)
    `)
    .eq("hospital_id", auth.access.hospitalId)
    .order("created_at", { ascending: false })
    .limit(200);

  if (Number.isInteger(petId)) query = query.eq("pet_id", petId);
  if (status) query = query.eq("status", status);

  const { data, error } = await query;

  if (error) {
    return NextResponse.json(
      { ok: false, message: error.message },
      { status: 400 },
    );
  }

  return NextResponse.json({ ok: true, prescriptions: data ?? [] });
}

export async function POST(request: Request) {
  const auth = await requirePrescriptionAccess(request, "write_prescription");

  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, message: auth.message },
      { status: auth.status },
    );
  }

  const body = await request.json();
  const petId = Number(body.petId);

  if (!Number.isInteger(petId)) {
    return NextResponse.json(
      { ok: false, message: "환자 정보를 확인해 주세요." },
      { status: 400 },
    );
  }

  const { data: pet } = await auth.supabaseAdmin
    .from("pets")
    .select("id")
    .eq("id", petId)
    .maybeSingle();

  if (!pet) {
    return NextResponse.json(
      { ok: false, message: "환자를 찾지 못했습니다." },
      { status: 404 },
    );
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
    .from("medication_orders")
    .insert({
      hospital_id: auth.access.hospitalId,
      pet_id: petId,
      emr_record_id: body.emrRecordId ? Number(body.emrRecordId) : null,
      reservation_id: body.reservationId ? Number(body.reservationId) : null,
      status: "draft",
      diagnosis_summary: String(body.diagnosisSummary ?? "").trim() || null,
      guardian_note: String(body.guardianNote ?? "").trim() || null,
      start_date: String(body.startDate ?? "").trim() || null,
      end_date: String(body.endDate ?? "").trim() || null,
      created_by: auth.user.id,
      updated_by: auth.user.id,
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json(
      { ok: false, message: error.message },
      { status: 400 },
    );
  }

  return NextResponse.json({ ok: true, prescriptionId: data.id });
}
