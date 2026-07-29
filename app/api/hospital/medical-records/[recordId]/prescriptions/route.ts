import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireHospitalContext } from "@/lib/hospital-api-auth";

function normalizeTimes(value: unknown) {
  if (!Array.isArray(value)) return [];

  return [...new Set(
    value
      .map((item) => String(item ?? "").trim())
      .filter((item) => /^([01]\d|2[0-3]):[0-5]\d$/.test(item)),
  )].sort();
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ recordId: string }> },
) {
  const context = await requireHospitalContext(request);

  if ("error" in context) {
    return NextResponse.json(
      { message: context.error },
      { status: context.status },
    );
  }

  const { recordId: recordIdParam } = await params;
  const recordId = Number(recordIdParam);
  const body = await request.json().catch(() => null);

  if (!Number.isInteger(recordId)) {
    return NextResponse.json(
      { message: "차트번호가 올바르지 않습니다." },
      { status: 400 },
    );
  }

  if (!String(body?.medication_name ?? "").trim()) {
    return NextResponse.json(
      { message: "약품명을 입력해주세요." },
      { status: 400 },
    );
  }

  const scheduledTimes = normalizeTimes(body?.scheduled_times);

  if (scheduledTimes.length === 0) {
    return NextResponse.json(
      { message: "복용 시간을 한 개 이상 입력해주세요." },
      { status: 400 },
    );
  }

  if (!body?.start_date || !body?.end_date) {
    return NextResponse.json(
      { message: "복용 시작일과 종료일을 입력해주세요." },
      { status: 400 },
    );
  }

  if (String(body.start_date) > String(body.end_date)) {
    return NextResponse.json(
      { message: "복용 종료일은 시작일보다 빠를 수 없습니다." },
      { status: 400 },
    );
  }

  const { data: record } = await supabaseAdmin
    .from("medical_records")
    .select("id")
    .eq("id", recordId)
    .eq("hospital_id", context.hospitalId)
    .maybeSingle();

  if (!record) {
    return NextResponse.json(
      { message: "차트를 찾을 수 없습니다." },
      { status: 404 },
    );
  }

  const { data: prescription, error } = await supabaseAdmin
    .from("medical_prescriptions")
    .insert({
      medical_record_id: recordId,
      hospital_id: context.hospitalId,
      medication_name: String(body.medication_name).trim(),
      dosage: String(body.dosage ?? "").trim() || null,
      frequency:
        String(body.frequency ?? "").trim() ||
        `하루 ${scheduledTimes.length}회`,
      duration: String(body.duration ?? "").trim() || null,
      route: String(body.route ?? "").trim() || null,
      instructions: String(body.instructions ?? "").trim() || null,
      start_date: String(body.start_date),
      end_date: String(body.end_date),
    })
    .select("*")
    .single();

  if (error || !prescription) {
    return NextResponse.json(
      { message: error?.message ?? "처방 저장 실패" },
      { status: 500 },
    );
  }

  const { error: scheduleError } = await supabaseAdmin
    .from("medical_prescription_schedules")
    .insert(
      scheduledTimes.map((scheduledTime) => ({
        medical_prescription_id: prescription.id,
        scheduled_time: `${scheduledTime}:00`,
      })),
    );

  if (scheduleError) {
    await supabaseAdmin
      .from("medical_prescriptions")
      .delete()
      .eq("id", prescription.id);

    return NextResponse.json(
      { message: `복용 시간 저장 실패: ${scheduleError.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({
    prescription: {
      ...prescription,
      medical_prescription_schedules: scheduledTimes.map(
        (scheduledTime, index) => ({
          id: index,
          scheduled_time: `${scheduledTime}:00`,
        }),
      ),
    },
  });
}
