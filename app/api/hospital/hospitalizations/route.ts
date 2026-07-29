import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireHospitalContext } from "@/lib/hospital-api-auth";
import {
  publishHospitalizationStatusToGuardian,
  resolveHospitalizationGuardianContext,
} from "@/lib/hospitalization-guardian-sync";

type CreateBody = {
  hospitalPatientId?: number;
  medicalRecordId?: number | null;
  reservationId?: number | null;
  admissionReason?: string;
  wardName?: string | null;
  cageNumber?: string | null;
  admittedAt?: string | null;
  expectedDischargeAt?: string | null;
  riskLevel?: string;
  isolationRequired?: boolean;
  fastingRequired?: boolean;
  internalNote?: string | null;
};

const riskLevels = new Set(["standard", "watch", "high", "critical"]);

function one<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

export async function GET(request: NextRequest) {
  const context = await requireHospitalContext(request);

  if ("error" in context) {
    return NextResponse.json(
      { message: context.error },
      { status: context.status },
    );
  }

  const searchParams = new URL(request.url).searchParams;
  const q = searchParams.get("q")?.trim().toLowerCase() ?? "";
  const status = searchParams.get("status")?.trim() ?? "active";
  const risk = searchParams.get("risk")?.trim() ?? "all";

  let query = supabaseAdmin
    .from("hospitalizations")
    .select(`
      id,
      hospital_id,
      medical_record_id,
      hospital_patient_id,
      reservation_id,
      status,
      admission_reason,
      ward_name,
      cage_number,
      admitted_at,
      expected_discharge_at,
      discharged_at,
      risk_level,
      isolation_required,
      fasting_required,
      internal_note,
      guardian_summary,
      is_guardian_visible,
      created_at,
      updated_at,
      hospital_patients(
        id,
        patient_number,
        pets(
          id,
          name,
          species,
          breed,
          gender,
          weight_kg
        ),
        reservations!hospital_patients_first_reservation_id_fkey(
          guardian_name,
          phone
        )
      )
    `)
    .eq("hospital_id", context.hospitalId)
    .order("admitted_at", { ascending: false });

  if (status === "active") {
    query = query.in("status", [
      "planned",
      "admitted",
      "in_treatment",
      "recovering",
      "ready_for_discharge",
    ]);
  } else if (status !== "all") {
    query = query.eq("status", status);
  }

  if (risk !== "all") {
    query = query.eq("risk_level", risk);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  const hospitalizations = (data ?? []).filter((row: any) => {
    if (!q) return true;

    const patient = one(row.hospital_patients);
    const pet = one(patient?.pets);
    const reservation = one(patient?.reservations);

    const haystack = [
      pet?.name,
      pet?.breed,
      pet?.species,
      patient?.patient_number,
      reservation?.guardian_name,
      reservation?.phone,
      row.ward_name,
      row.cage_number,
      row.admission_reason,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return haystack.includes(q);
  });

  const activeRows = (data ?? []).filter((row: any) =>
    [
      "planned",
      "admitted",
      "in_treatment",
      "recovering",
      "ready_for_discharge",
    ].includes(row.status),
  );

  const today = new Date().toISOString().slice(0, 10);
  const stats = {
    active: activeRows.length,
    critical: activeRows.filter((row: any) => row.risk_level === "critical")
      .length,
    highRisk: activeRows.filter((row: any) =>
      ["high", "critical"].includes(row.risk_level),
    ).length,
    isolation: activeRows.filter((row: any) => row.isolation_required).length,
    expectedDischargeToday: activeRows.filter(
      (row: any) =>
        row.expected_discharge_at &&
        String(row.expected_discharge_at).slice(0, 10) === today,
    ).length,
  };

  return NextResponse.json({ hospitalizations, stats });
}

export async function POST(request: NextRequest) {
  const context = await requireHospitalContext(request);

  if ("error" in context) {
    return NextResponse.json(
      { message: context.error },
      { status: context.status },
    );
  }

  const body = (await request.json()) as CreateBody;
  const hospitalPatientId = Number(body.hospitalPatientId);
  const admissionReason = String(body.admissionReason ?? "").trim();
  const riskLevel = String(body.riskLevel ?? "standard").trim();

  if (!Number.isInteger(hospitalPatientId)) {
    return NextResponse.json(
      { message: "입원 환자를 선택해 주세요." },
      { status: 400 },
    );
  }

  if (!admissionReason) {
    return NextResponse.json(
      { message: "입원 사유를 입력해 주세요." },
      { status: 400 },
    );
  }

  if (!riskLevels.has(riskLevel)) {
    return NextResponse.json(
      { message: "위험도 값이 올바르지 않습니다." },
      { status: 400 },
    );
  }

  const { data: patient, error: patientError } = await supabaseAdmin
    .from("hospital_patients")
    .select(`
      id,
      hospital_id,
      pet_id,
      pets(id, name, user_id),
      reservations!hospital_patients_first_reservation_id_fkey(id, user_id)
    `)
    .eq("id", hospitalPatientId)
    .eq("hospital_id", context.hospitalId)
    .maybeSingle();

  if (patientError) {
    return NextResponse.json(
      { message: patientError.message },
      { status: 500 },
    );
  }

  if (!patient) {
    return NextResponse.json(
      { message: "해당 병원의 환자를 찾을 수 없습니다." },
      { status: 404 },
    );
  }

  const { data: duplicate, error: duplicateError } = await supabaseAdmin
    .from("hospitalizations")
    .select("id")
    .eq("hospital_id", context.hospitalId)
    .eq("hospital_patient_id", hospitalPatientId)
    .in("status", [
      "planned",
      "admitted",
      "in_treatment",
      "recovering",
      "ready_for_discharge",
    ])
    .limit(1)
    .maybeSingle();

  if (duplicateError) {
    return NextResponse.json(
      { message: duplicateError.message },
      { status: 500 },
    );
  }

  if (duplicate) {
    return NextResponse.json(
      { message: "이미 입원 중이거나 입원 예정인 환자입니다." },
      { status: 409 },
    );
  }

  const payload = {
    hospital_id: context.hospitalId,
    hospital_patient_id: hospitalPatientId,
    medical_record_id:
      Number.isInteger(Number(body.medicalRecordId))
        ? Number(body.medicalRecordId)
        : null,
    reservation_id:
      Number.isInteger(Number(body.reservationId))
        ? Number(body.reservationId)
        : null,
    status: "admitted",
    admission_reason: admissionReason,
    ward_name: String(body.wardName ?? "").trim() || null,
    cage_number: String(body.cageNumber ?? "").trim() || null,
    admitted_at: body.admittedAt || new Date().toISOString(),
    expected_discharge_at: body.expectedDischargeAt || null,
    risk_level: riskLevel,
    isolation_required: Boolean(body.isolationRequired),
    fasting_required: Boolean(body.fastingRequired),
    internal_note: String(body.internalNote ?? "").trim() || null,
    created_by: context.user.id,
  };

  const { data, error } = await supabaseAdmin
    .from("hospitalizations")
    .insert(payload)
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  await supabaseAdmin.from("inpatient_surgery_audit_logs").insert({
    hospital_id: context.hospitalId,
    hospitalization_id: data.id,
    actor_user_id: context.user.id,
    action: "hospitalization_created",
    after_data: payload,
  });

  const guardianContext = await resolveHospitalizationGuardianContext(
    data.id,
    context.hospitalId,
  );

  if (guardianContext) {
    await publishHospitalizationStatusToGuardian({
      context: guardianContext,
      status: "admitted",
      actorUserId: context.user.id,
      occurredAt: String(payload.admitted_at),
    });
  }

  return NextResponse.json(
    {
      hospitalizationId: data.id,
      message: "입원 등록이 완료되었습니다.",
    },
    { status: 201 },
  );
}
