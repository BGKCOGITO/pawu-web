import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireHospitalContext } from "@/lib/hospital-api-auth";

const statuses = new Set(["planned", "active", "paused", "completed", "cancelled"]);

type Body = { status?: string };

async function findOwnedPlan(planId: number, hospitalizationId: number, hospitalId: number) {
  const { data: hospitalization, error: hospitalizationError } = await supabaseAdmin
    .from("hospitalizations")
    .select("id")
    .eq("id", hospitalizationId)
    .eq("hospital_id", hospitalId)
    .maybeSingle();

  if (hospitalizationError || !hospitalization) {
    return { data: null, error: hospitalizationError };
  }

  return supabaseAdmin
    .from("hospitalization_care_plans")
    .select("*")
    .eq("id", planId)
    .eq("hospitalization_id", hospitalizationId)
    .maybeSingle();
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ hospitalizationId: string; planId: string }> },
) {
  const context = await requireHospitalContext(request);
  if ("error" in context) return NextResponse.json({ message: context.error }, { status: context.status });

  const values = await params;
  const hospitalizationId = Number(values.hospitalizationId);
  const planId = Number(values.planId);
  if (!Number.isInteger(hospitalizationId) || !Number.isInteger(planId)) {
    return NextResponse.json({ message: "치료 계획 번호가 올바르지 않습니다." }, { status: 400 });
  }

  const { data: existing, error: findError } = await findOwnedPlan(planId, hospitalizationId, context.hospitalId);
  if (findError) return NextResponse.json({ message: findError.message }, { status: 500 });
  if (!existing) return NextResponse.json({ message: "치료 계획을 찾을 수 없습니다." }, { status: 404 });

  const body = (await request.json()) as Body;
  const status = String(body.status ?? "").trim();
  if (!statuses.has(status)) {
    return NextResponse.json({ message: "치료 계획 상태가 올바르지 않습니다." }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("hospitalization_care_plans")
    .update({ status })
    .eq("id", planId)
    .select("*")
    .single();
  if (error) return NextResponse.json({ message: error.message }, { status: 500 });

  await supabaseAdmin.from("inpatient_surgery_audit_logs").insert({
    hospital_id: context.hospitalId,
    hospitalization_id: hospitalizationId,
    actor_user_id: context.user.id,
    action: "hospitalization_care_plan_status_changed",
    before_data: existing,
    after_data: data,
  });

  return NextResponse.json({ carePlan: data, message: "치료 계획 상태가 변경되었습니다." });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ hospitalizationId: string; planId: string }> },
) {
  const context = await requireHospitalContext(request);
  if ("error" in context) return NextResponse.json({ message: context.error }, { status: context.status });

  const values = await params;
  const hospitalizationId = Number(values.hospitalizationId);
  const planId = Number(values.planId);
  if (!Number.isInteger(hospitalizationId) || !Number.isInteger(planId)) {
    return NextResponse.json({ message: "치료 계획 번호가 올바르지 않습니다." }, { status: 400 });
  }

  const { data: existing, error: findError } = await findOwnedPlan(planId, hospitalizationId, context.hospitalId);
  if (findError) return NextResponse.json({ message: findError.message }, { status: 500 });
  if (!existing) return NextResponse.json({ message: "치료 계획을 찾을 수 없습니다." }, { status: 404 });

  const { error } = await supabaseAdmin.from("hospitalization_care_plans").delete().eq("id", planId);
  if (error) return NextResponse.json({ message: error.message }, { status: 500 });

  await supabaseAdmin.from("inpatient_surgery_audit_logs").insert({
    hospital_id: context.hospitalId,
    hospitalization_id: hospitalizationId,
    actor_user_id: context.user.id,
    action: "hospitalization_care_plan_deleted",
    before_data: existing,
  });

  return NextResponse.json({ message: "치료 계획이 삭제되었습니다." });
}
