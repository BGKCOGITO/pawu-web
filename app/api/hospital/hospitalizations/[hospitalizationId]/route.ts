import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireHospitalContext } from "@/lib/hospital-api-auth";
import {
  publishHospitalizationStatusToGuardian,
  resolveHospitalizationGuardianContext,
} from "@/lib/hospitalization-guardian-sync";

type UpdateBody = {
  status?: string;
  wardName?: string | null;
  cageNumber?: string | null;
  expectedDischargeAt?: string | null;
  riskLevel?: string;
  isolationRequired?: boolean;
  fastingRequired?: boolean;
  internalNote?: string | null;
};

const statuses = new Set([
  "planned",
  "admitted",
  "in_treatment",
  "recovering",
  "ready_for_discharge",
  "discharged",
  "cancelled",
]);

const riskLevels = new Set(["standard", "watch", "high", "critical"]);

export async function PATCH(
  request: NextRequest,
  {
    params,
  }: {
    params: Promise<{ hospitalizationId: string }>;
  },
) {
  const context = await requireHospitalContext(request);

  if ("error" in context) {
    return NextResponse.json(
      { message: context.error },
      { status: context.status },
    );
  }

  const { hospitalizationId: rawId } = await params;
  const hospitalizationId = Number(rawId);

  if (!Number.isInteger(hospitalizationId)) {
    return NextResponse.json(
      { message: "입원 기록 번호가 올바르지 않습니다." },
      { status: 400 },
    );
  }

  const body = (await request.json()) as UpdateBody;

  const { data: current, error: currentError } = await supabaseAdmin
    .from("hospitalizations")
    .select("*")
    .eq("id", hospitalizationId)
    .eq("hospital_id", context.hospitalId)
    .maybeSingle();

  if (currentError) {
    return NextResponse.json(
      { message: currentError.message },
      { status: 500 },
    );
  }

  if (!current) {
    return NextResponse.json(
      { message: "입원 기록을 찾을 수 없습니다." },
      { status: 404 },
    );
  }

  const updates: Record<string, unknown> = {};

  if (body.status !== undefined) {
    const status = String(body.status);
    if (!statuses.has(status)) {
      return NextResponse.json(
        { message: "입원 상태가 올바르지 않습니다." },
        { status: 400 },
      );
    }
    updates.status = status;
    updates.discharged_at =
      status === "discharged" ? new Date().toISOString() : null;
  }

  if (body.riskLevel !== undefined) {
    const riskLevel = String(body.riskLevel);
    if (!riskLevels.has(riskLevel)) {
      return NextResponse.json(
        { message: "위험도가 올바르지 않습니다." },
        { status: 400 },
      );
    }
    updates.risk_level = riskLevel;
  }

  if (body.wardName !== undefined) {
    updates.ward_name = String(body.wardName ?? "").trim() || null;
  }

  if (body.cageNumber !== undefined) {
    updates.cage_number = String(body.cageNumber ?? "").trim() || null;
  }

  if (body.expectedDischargeAt !== undefined) {
    updates.expected_discharge_at = body.expectedDischargeAt || null;
  }

  if (body.isolationRequired !== undefined) {
    updates.isolation_required = Boolean(body.isolationRequired);
  }

  if (body.fastingRequired !== undefined) {
    updates.fasting_required = Boolean(body.fastingRequired);
  }

  if (body.internalNote !== undefined) {
    updates.internal_note =
      String(body.internalNote ?? "").trim() || null;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { message: "변경할 내용이 없습니다." },
      { status: 400 },
    );
  }

  const { data, error } = await supabaseAdmin
    .from("hospitalizations")
    .update(updates)
    .eq("id", hospitalizationId)
    .eq("hospital_id", context.hospitalId)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  await supabaseAdmin.from("inpatient_surgery_audit_logs").insert({
    hospital_id: context.hospitalId,
    hospitalization_id: hospitalizationId,
    actor_user_id: context.user.id,
    action: "hospitalization_updated",
    before_data: current,
    after_data: data,
  });

  const previousStatus = String(current.status ?? "");
  const nextStatus = String(data.status ?? "");

  if (
    previousStatus !== nextStatus &&
    (nextStatus === "admitted" || nextStatus === "discharged")
  ) {
    const guardianContext = await resolveHospitalizationGuardianContext(
      hospitalizationId,
      context.hospitalId,
    );

    if (guardianContext) {
      await publishHospitalizationStatusToGuardian({
        context: guardianContext,
        status: nextStatus,
        actorUserId: context.user.id,
        occurredAt:
          nextStatus === "discharged"
            ? String(data.discharged_at ?? new Date().toISOString())
            : String(data.admitted_at ?? new Date().toISOString()),
      });
    }
  }

  return NextResponse.json({
    hospitalization: data,
    message: "입원 정보가 변경되었습니다.",
  });
}
