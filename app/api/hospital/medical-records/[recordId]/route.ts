import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireHospitalContext } from "@/lib/hospital-api-auth";
import { enforceRateLimit } from "@/lib/server/security-policy";
import { writeAuditLogV2 } from "@/lib/server/audit-v2";

const fields = [
  "chief_complaint",
  "subjective",
  "objective",
  "assessment",
  "plan",
  "diagnosis",
  "treatment",
  "follow_up",
  "veterinarian_note",
  "guardian_summary",
  "care_instructions",
  "medication_instructions",
  "next_visit_date",
  "status",
] as const;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ recordId: string }> },
) {
  const context = await requireHospitalContext(request, "view_medical_records");

  if ("error" in context) {
    return NextResponse.json(
      { message: context.error },
      { status: context.status },
    );
  }

  const { recordId: recordIdParam } = await params;
  const recordId = Number(recordIdParam);

  if (!Number.isInteger(recordId)) {
    return NextResponse.json(
      { message: "차트번호가 올바르지 않습니다." },
      { status: 400 },
    );
  }

  const { data, error } = await supabaseAdmin
    .from("medical_records")
    .select(`
      *,
      hospital_patients(
        id,patient_number,
        pets(
          id,name,species,breed,birth_date,gender,weight_kg,notes
        )
      ),
      reservations(
        id,guardian_name,phone,reservation_date,reservation_time,
        visit_reason,symptoms,status,
        visit_preparations(
          main_concern,generated_summary,generated_timeline,generated_key_points,
          visit_preparation_events(
            sort_order,
            pet_health_events(
              id,occurred_at,event_type,title,severity,priority,count_value,note
            )
          )
        )
      ),
      medical_prescriptions(
        *,
        medical_prescription_schedules(
          id,scheduled_time
        )
      )
    `)
    .eq("id", recordId)
    .eq("hospital_id", context.hospitalId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json(
      { message: "차트를 찾을 수 없습니다." },
      { status: 404 },
    );
  }

  return NextResponse.json({ record: data });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ recordId: string }> },
) {
  const limited = enforceRateLimit(request, { scope: "medical-record-write", limit: 180, windowMs: 60_000 });
  if (limited) return limited;

  const context = await requireHospitalContext(request, "write_medical_records");

  if ("error" in context) {
    return NextResponse.json(
      { message: context.error },
      { status: context.status },
    );
  }

  const { recordId: recordIdParam } = await params;
  const recordId = Number(recordIdParam);
  const body = await request.json().catch(() => null);

  if (!Number.isInteger(recordId) || !body) {
    return NextResponse.json(
      { message: "차트 저장 요청이 올바르지 않습니다." },
      { status: 400 },
    );
  }

  const { data: existingRecord, error: recordReadError } = await supabaseAdmin
    .from("medical_records")
    .select(`
      id,hospital_id,hospital_patient_id,pet_id,reservation_id,status,
      hospital_patients(id)
    `)
    .eq("id", recordId)
    .eq("hospital_id", context.hospitalId)
    .maybeSingle();

  if (recordReadError) {
    return NextResponse.json(
      { message: recordReadError.message },
      { status: 500 },
    );
  }

  if (!existingRecord) {
    return NextResponse.json(
      { message: "저장할 차트를 찾을 수 없습니다." },
      { status: 404 },
    );
  }

  const now = new Date().toISOString();
  const nextStatus = String(body.status ?? existingRecord.status ?? "draft");
  const update: Record<string, unknown> = {
    updated_at: now,
  };

  for (const field of fields) {
    if (field in body) {
      update[field] = body[field] === "" ? "" : body[field] ?? null;
    }
  }

  if (nextStatus === "completed") {
    update.status = "completed";
    update.completed_at = now;
  }

  const { error: recordUpdateError } = await supabaseAdmin
    .from("medical_records")
    .update(update)
    .eq("id", recordId)
    .eq("hospital_id", context.hospitalId);

  if (recordUpdateError) {
    return NextResponse.json(
      { message: recordUpdateError.message },
      { status: 500 },
    );
  }

  if (nextStatus === "completed") {
    /*
     * 차트 완료를 병원 업무 흐름의 완료 신호로 사용합니다.
     *
     * 1. 연결된 예약을 completed로 변경
     * 2. 병원 환자의 최근 방문일 갱신
     *
     * 오늘의 업무, 예약관리, 보호자 예약조회는 reservations.status를
     * 사용하므로 별도 화면 수정 없이 완료 상태가 함께 반영됩니다.
     */
    if (existingRecord.reservation_id) {
      const { error: reservationError } = await supabaseAdmin
        .from("reservations")
        .update({ status: "completed" })
        .eq("id", existingRecord.reservation_id)
        .eq("hospital_id", context.hospitalId);

      if (reservationError) {
        return NextResponse.json(
          {
            message:
              "차트는 저장됐지만 예약 완료 연동에 실패했습니다: " +
              reservationError.message,
            partial_success: true,
          },
          { status: 500 },
        );
      }
    }

    if (existingRecord.hospital_patient_id) {
      const { error: patientError } = await supabaseAdmin
        .from("hospital_patients")
        .update({
          last_visit_at: now,
          updated_at: now,
        })
        .eq("id", existingRecord.hospital_patient_id)
        .eq("hospital_id", context.hospitalId);

      if (patientError) {
        return NextResponse.json(
          {
            message:
              "차트와 예약은 완료됐지만 환자 최근 방문일 갱신에 실패했습니다: " +
              patientError.message,
            partial_success: true,
          },
          { status: 500 },
        );
      }
    }
  }

  await writeAuditLogV2({
    request,
    actorUserId: context.user.id,
    actorType: "hospital",
    hospitalId: context.hospitalId,
    action: "medical_record.updated",
    entityType: "medical_record",
    entityId: recordId,
    before: { status: existingRecord.status },
    after: { status: nextStatus, changedFields: Object.keys(update) },
  });

  return NextResponse.json({
    success: true,
    record_status: nextStatus,
    reservation_status:
      nextStatus === "completed" && existingRecord.reservation_id
        ? "completed"
        : null,
    completed_at: nextStatus === "completed" ? now : null,
  });
}
