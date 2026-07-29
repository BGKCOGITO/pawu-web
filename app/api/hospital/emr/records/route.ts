import { NextResponse } from "next/server";
import { requireEmrEditorAccess } from "../../../../../lib/v6-5-5a-emr-access";

export async function GET(request: Request) {
  const auth = await requireEmrEditorAccess(request, "view");

  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, message: auth.message },
      { status: auth.status },
    );
  }

  const url = new URL(request.url);
  const petId = Number(url.searchParams.get("petId"));
  const reservationId = Number(url.searchParams.get("reservationId"));

  let query = auth.supabaseAdmin
    .from("emr_records")
    .select(`
      id, hospital_id, pet_id, reservation_id, status,
      chief_complaint, subjective, objective, assessment, plan,
      diagnosis_summary, weight_kg, temperature_c, heart_rate,
      respiratory_rate, bcs, crt_seconds, next_visit_date,
      created_by, finalized_by, finalized_at, created_at, updated_at,
      pets(id, name, species, breed, gender, birth_date, weight_kg)
    `)
    .eq("hospital_id", auth.access.hospitalId)
    .order("created_at", { ascending: false })
    .limit(300);

  if (Number.isInteger(petId) && petId > 0) query = query.eq("pet_id", petId);
  if (Number.isInteger(reservationId) && reservationId > 0) {
    query = query.eq("reservation_id", reservationId);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json(
      { ok: false, message: error.message },
      { status: 400 },
    );
  }

  return NextResponse.json({ ok: true, records: data ?? [] });
}

export async function POST(request: Request) {
  const auth = await requireEmrEditorAccess(request, "write");

  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, message: auth.message },
      { status: auth.status },
    );
  }

  const body = await request.json();
  const petId = Number(body.petId);
  const reservationId =
    body.reservationId === "" || body.reservationId == null
      ? null
      : Number(body.reservationId);

  if (!Number.isInteger(petId) || petId <= 0) {
    return NextResponse.json(
      { ok: false, message: "환자를 선택해 주세요." },
      { status: 400 },
    );
  }

  const { data: accessiblePet } = await auth.supabaseAdmin
    .from("reservations")
    .select("id")
    .eq("hospital_id", auth.access.hospitalId)
    .eq("pet_id", petId)
    .limit(1)
    .maybeSingle();

  if (!accessiblePet) {
    return NextResponse.json(
      { ok: false, message: "이 병원에서 조회할 수 없는 환자입니다." },
      { status: 403 },
    );
  }

  if (reservationId) {
    const { data: reservation } = await auth.supabaseAdmin
      .from("reservations")
      .select("id, pet_id")
      .eq("id", reservationId)
      .eq("hospital_id", auth.access.hospitalId)
      .maybeSingle();

    if (!reservation || Number(reservation.pet_id) !== petId) {
      return NextResponse.json(
        { ok: false, message: "예약과 환자 정보가 일치하지 않습니다." },
        { status: 400 },
      );
    }
  }

  const { data, error } = await auth.supabaseAdmin
    .from("emr_records")
    .insert({
      hospital_id: auth.access.hospitalId,
      pet_id: petId,
      reservation_id: reservationId,
      status: "draft",
      chief_complaint: String(body.chiefComplaint ?? "").trim() || null,
      subjective: String(body.subjective ?? "").trim() || null,
      objective: String(body.objective ?? "").trim() || null,
      assessment: String(body.assessment ?? "").trim() || null,
      plan: String(body.plan ?? "").trim() || null,
      diagnosis_summary: String(body.diagnosisSummary ?? "").trim() || null,
      weight_kg: body.weightKg === "" ? null : Number(body.weightKg),
      temperature_c:
        body.temperatureC === "" ? null : Number(body.temperatureC),
      heart_rate: body.heartRate === "" ? null : Number(body.heartRate),
      respiratory_rate:
        body.respiratoryRate === "" ? null : Number(body.respiratoryRate),
      bcs: body.bcs === "" ? null : Number(body.bcs),
      crt_seconds: body.crtSeconds === "" ? null : Number(body.crtSeconds),
      next_visit_date: String(body.nextVisitDate ?? "").trim() || null,
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

  return NextResponse.json({ ok: true, id: data.id }, { status: 201 });
}
