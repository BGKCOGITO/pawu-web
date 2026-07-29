import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireHospitalContext } from "@/lib/hospital-api-auth";

export async function GET(request: NextRequest) {
  const context = await requireHospitalContext(request);
  if ("error" in context) {
    return NextResponse.json({ message: context.error }, { status: context.status });
  }

  const { data, error } = await supabaseAdmin
    .from("medical_records")
    .select(`
      id,hospital_patient_id,pet_id,reservation_id,chief_complaint,
      diagnosis,status,completed_at,created_at,updated_at,
      hospital_patients(
        id,patient_number,
        pets(id,name,species,breed)
      )
    `)
    .eq("hospital_id", context.hospitalId)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ message: error.message }, { status: 500 });
  return NextResponse.json({ records: data ?? [] });
}

export async function POST(request: NextRequest) {
  const context = await requireHospitalContext(request);
  if ("error" in context) {
    return NextResponse.json({ message: context.error }, { status: context.status });
  }

  const body = await request.json().catch(() => null);
  const reservationId = Number(body?.reservation_id);

  if (!Number.isInteger(reservationId)) {
    return NextResponse.json({ message: "예약번호가 필요합니다." }, { status: 400 });
  }

  const { data: reservation } = await supabaseAdmin
    .from("reservations")
    .select(`
      id,hospital_id,pet_id,user_id,guardian_name,phone,symptoms,status,
      visit_preparations(main_concern,generated_summary)
    `)
    .eq("id", reservationId)
    .eq("hospital_id", context.hospitalId)
    .maybeSingle();

  if (!reservation?.pet_id) {
    return NextResponse.json({ message: "예약 또는 반려동물 정보를 찾을 수 없습니다." }, { status: 404 });
  }

  const { data: patient, error: patientError } = await supabaseAdmin
    .from("hospital_patients")
    .upsert(
      {
        hospital_id: context.hospitalId,
        pet_id: reservation.pet_id,
        guardian_user_id: reservation.user_id,
        first_reservation_id: reservation.id,
        patient_number: `${context.hospitalId}-${reservation.pet_id}`,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "hospital_id,pet_id" },
    )
    .select("id")
    .single();

  if (patientError || !patient) {
    return NextResponse.json(
      { message: patientError?.message ?? "환자 연결 실패" },
      { status: 500 },
    );
  }

  const prep = Array.isArray((reservation as any).visit_preparations)
    ? (reservation as any).visit_preparations[0]
    : (reservation as any).visit_preparations;

  const { data: existing } = await supabaseAdmin
    .from("medical_records")
    .select("id")
    .eq("reservation_id", reservation.id)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ record_id: existing.id, existing: true });
  }

  const { data: record, error } = await supabaseAdmin
    .from("medical_records")
    .insert({
      hospital_id: context.hospitalId,
      hospital_patient_id: patient.id,
      pet_id: reservation.pet_id,
      reservation_id: reservation.id,
      veterinarian_user_id: context.user.id,
      guardian_information: [
        `보호자: ${reservation.guardian_name}`,
        `연락처: ${reservation.phone}`,
        reservation.symptoms ? `특이사항: ${reservation.symptoms}` : "",
      ].filter(Boolean).join("\n"),
      ai_reference_summary: prep?.generated_summary ?? "",
      chief_complaint: prep?.main_concern ?? reservation.symptoms ?? "",
      subjective: "",
      objective: "",
      assessment: "",
      plan: "",
      diagnosis: "",
      treatment: "",
      follow_up: "",
      veterinarian_note: "",
      doctor_note: "",
      status: "draft",
    })
    .select("id")
    .single();

  if (error || !record) {
    return NextResponse.json({ message: error?.message ?? "차트 생성 실패" }, { status: 500 });
  }

  return NextResponse.json({ record_id: record.id, existing: false });
}
