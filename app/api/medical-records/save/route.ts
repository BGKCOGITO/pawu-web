import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PrescriptionInput = {
  medicine_name: string;
  dosage: string;
  instructions?: string | null;
  times_per_day: number;
  duration_days: number;
  start_date: string;
  scheduled_times?: string[];
};

type VaccinationInput = {
  vaccine_name: string;
  manufacturer?: string | null;
  vaccinated_at: string;
  next_due_date?: string | null;
  memo?: string | null;
};

function addDays(dateText: string, days: number) {
  const date = new Date(`${dateText}T00:00:00`);
  date.setDate(date.getDate() + Math.max(days - 1, 0));
  return date.toISOString().slice(0, 10);
}

function readBearer(request: Request) {
  const value = request.headers.get("authorization") ?? "";
  return value.startsWith("Bearer ") ? value.slice(7) : "";
}

export async function POST(request: Request) {
  const accessToken = readBearer(request);

  if (!accessToken) {
    return NextResponse.json(
      { ok: false, message: "로그인이 필요합니다." },
      { status: 401 },
    );
  }

  const { data: authData, error: authError } =
    await supabaseAdmin.auth.getUser(accessToken);

  if (authError || !authData.user) {
    return NextResponse.json(
      { ok: false, message: "로그인 정보를 확인하지 못했습니다." },
      { status: 401 },
    );
  }

  const body = (await request.json()) as {
    reservationId?: number;
    diagnosis?: string;
    doctorNote?: string;
    careInstructions?: string;
    medicationInstructions?: string;
    examResults?: string;
    weightKg?: number | null;
    temperatureC?: number | null;
    nextVisitDate?: string | null;
    prescriptions?: PrescriptionInput[];
    vaccinations?: VaccinationInput[];
  };

  const reservationId = Number(body.reservationId);
  const diagnosis = String(body.diagnosis ?? "").trim();

  if (!Number.isInteger(reservationId) || !diagnosis) {
    return NextResponse.json(
      { ok: false, message: "예약과 진료 소견을 확인해 주세요." },
      { status: 400 },
    );
  }

  const { data: reservation, error: reservationError } =
    await supabaseAdmin
      .from("reservations")
      .select("id, hospital_id, user_id, pet_id, status")
      .eq("id", reservationId)
      .maybeSingle();

  if (reservationError || !reservation) {
    return NextResponse.json(
      { ok: false, message: "예약을 찾지 못했습니다." },
      { status: 404 },
    );
  }

  const { data: hospitalAdmin } = await supabaseAdmin
    .from("hospital_admins")
    .select("id")
    .eq("user_id", authData.user.id)
    .eq("hospital_id", reservation.hospital_id)
    .maybeSingle();

  if (!hospitalAdmin) {
    return NextResponse.json(
      { ok: false, message: "해당 병원의 진료기록 권한이 없습니다." },
      { status: 403 },
    );
  }

  if (!["approved", "in_progress", "completed"].includes(reservation.status)) {
    return NextResponse.json(
      { ok: false, message: "진료기록을 작성할 수 없는 예약 상태입니다." },
      { status: 409 },
    );
  }

  const now = new Date().toISOString();
  const easyExplanation = [
    diagnosis ? `진료 소견: ${diagnosis}` : "",
    body.examResults ? `검사 내용: ${body.examResults}` : "",
    body.careInstructions ? `집에서의 관리: ${body.careInstructions}` : "",
    body.medicationInstructions ? `복약 안내: ${body.medicationInstructions}` : "",
    body.nextVisitDate ? `다음 확인 권장일: ${body.nextVisitDate}` : "",
    "이 설명은 병원이 입력한 기록을 쉽게 정리한 것이며 새로운 진단을 내리지 않습니다.",
  ].filter(Boolean).join("\n\n");

  const { data: record, error: recordError } =
    await supabaseAdmin
      .from("medical_records")
      .upsert(
        {
          reservation_id: reservation.id,
          hospital_id: reservation.hospital_id,
          user_id: reservation.user_id,
          pet_id: reservation.pet_id,
          diagnosis,
          doctor_note: String(body.doctorNote ?? ""),
          care_instructions: String(body.careInstructions ?? ""),
          medication_instructions: String(body.medicationInstructions ?? "") || null,
          exam_results: String(body.examResults ?? "") || null,
          weight_kg: body.weightKg ?? null,
          temperature_c: body.temperatureC ?? null,
          next_visit_date: body.nextVisitDate || null,
          easy_explanation: easyExplanation,
          updated_at: now,
        },
        { onConflict: "reservation_id" },
      )
      .select("id")
      .single();

  if (recordError || !record) {
    return NextResponse.json(
      { ok: false, message: recordError?.message ?? "진료기록을 저장하지 못했습니다." },
      { status: 400 },
    );
  }

  await supabaseAdmin
    .from("prescriptions")
    .delete()
    .eq("medical_record_id", record.id);

  for (const prescription of body.prescriptions ?? []) {
    const startDate = prescription.start_date;
    const endDate = addDays(startDate, prescription.duration_days);

    const { data: savedPrescription, error } = await supabaseAdmin
      .from("prescriptions")
      .insert({
        medical_record_id: record.id,
        user_id: reservation.user_id,
        pet_id: reservation.pet_id,
        medicine_name: prescription.medicine_name,
        dosage: prescription.dosage,
        instructions: prescription.instructions ?? null,
        times_per_day: prescription.times_per_day,
        duration_days: prescription.duration_days,
        start_date: startDate,
        end_date: endDate,
      })
      .select("id")
      .single();

    if (error || !savedPrescription) {
      return NextResponse.json(
        { ok: false, message: error?.message ?? "처방을 저장하지 못했습니다." },
        { status: 400 },
      );
    }

    for (const scheduledTime of prescription.scheduled_times ?? []) {
      await supabaseAdmin.from("medication_schedules").insert({
        prescription_id: savedPrescription.id,
        user_id: reservation.user_id,
        pet_id: reservation.pet_id,
        scheduled_time: scheduledTime,
        is_active: true,
      });
    }

    await supabaseAdmin.from("reminders").insert({
      user_id: reservation.user_id,
      pet_id: reservation.pet_id,
      reminder_type: "medication",
      title: `${prescription.medicine_name} 복약`,
      message: prescription.instructions ?? `${prescription.dosage} 복용`,
      remind_date: startDate,
      remind_time: (prescription.scheduled_times ?? [])[0] ?? null,
      related_type: "prescription",
      related_id: savedPrescription.id,
      is_active: true,
    });
  }

  await supabaseAdmin
    .from("vaccination_records")
    .delete()
    .eq("medical_record_id", record.id);

  for (const vaccination of body.vaccinations ?? []) {
    const { data: savedVaccination, error } = await supabaseAdmin
      .from("vaccination_records")
      .insert({
        medical_record_id: record.id,
        user_id: reservation.user_id,
        pet_id: reservation.pet_id,
        hospital_id: reservation.hospital_id,
        vaccine_name: vaccination.vaccine_name,
        manufacturer: vaccination.manufacturer ?? null,
        vaccinated_at: vaccination.vaccinated_at,
        next_due_date: vaccination.next_due_date ?? null,
        memo: vaccination.memo ?? null,
      })
      .select("id")
      .single();

    if (error) {
      return NextResponse.json(
        { ok: false, message: error.message },
        { status: 400 },
      );
    }

    if (vaccination.next_due_date && savedVaccination) {
      await supabaseAdmin.from("reminders").insert({
        user_id: reservation.user_id,
        pet_id: reservation.pet_id,
        reminder_type: "vaccination",
        title: `${vaccination.vaccine_name} 다음 접종`,
        message: "예방접종 예정일이 다가옵니다.",
        remind_date: vaccination.next_due_date,
        related_type: "vaccination",
        related_id: savedVaccination.id,
        is_active: true,
      });
    }
  }

  if (body.nextVisitDate) {
    await supabaseAdmin.from("reminders").insert({
      user_id: reservation.user_id,
      pet_id: reservation.pet_id,
      reminder_type: "next_visit",
      title: "다음 진료 예정",
      message: "병원에서 안내한 다음 진료일입니다.",
      remind_date: body.nextVisitDate,
      related_type: "medical_record",
      related_id: record.id,
      is_active: true,
    });
  }

  if (body.weightKg && reservation.pet_id) {
    await supabaseAdmin.from("weight_records").insert({
      user_id: reservation.user_id,
      pet_id: reservation.pet_id,
      weight_kg: body.weightKg,
      measured_at: new Date().toISOString().slice(0, 10),
      memo: "병원 진료기록에서 자동 등록",
    });

    await supabaseAdmin
      .from("pets")
      .update({ weight_kg: body.weightKg })
      .eq("id", reservation.pet_id)
      .eq("user_id", reservation.user_id);
  }

  await supabaseAdmin
    .from("reservations")
    .update({ status: "completed" })
    .eq("id", reservation.id);

  return NextResponse.json({ ok: true, medicalRecordId: record.id });
}
