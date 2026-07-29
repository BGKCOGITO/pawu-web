import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  isHospitalDiagnosticAuthError,
  requireHospitalDiagnosticContext,
} from "@/lib/hospital-diagnostic-auth";

const statuses = new Set([
  "ordered",
  "scheduled",
  "collecting",
  "in_progress",
  "completed",
  "cancelled",
]);

const priorities = new Set(["routine", "urgent", "stat"]);

type UpdateBody = {
  status?: string;
  priority?: string;
  scheduledAt?: string | null;
  clinicalNote?: string | null;
  interpretation?: string | null;
  internalNote?: string | null;
  guardianSummary?: string | null;
  isGuardianVisible?: boolean;
};

export async function PATCH(
  request: Request,
  {
    params,
  }: {
    params: Promise<{ diagnosticId: string }>;
  },
) {
  const context = await requireHospitalDiagnosticContext(request);

  if (isHospitalDiagnosticAuthError(context)) {
    return NextResponse.json(
      { message: context.error },
      { status: context.status },
    );
  }

  const { diagnosticId: diagnosticIdParam } = await params;
  const diagnosticId = Number(diagnosticIdParam);
  const body = (await request.json()) as UpdateBody;

  if (!Number.isInteger(diagnosticId)) {
    return NextResponse.json(
      { message: "검사 번호가 올바르지 않습니다." },
      { status: 400 },
    );
  }

  const { data: current, error: currentError } = await supabaseAdmin
    .from("diagnostic_orders")
    .select("*")
    .eq("id", diagnosticId)
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
      { message: "검사 기록을 찾을 수 없습니다." },
      { status: 404 },
    );
  }

  const update: Record<string, unknown> = {};

  if (body.status !== undefined) {
    if (!statuses.has(body.status)) {
      return NextResponse.json(
        { message: "검사 상태가 올바르지 않습니다." },
        { status: 400 },
      );
    }

    update.status = body.status;

    if (body.status === "in_progress" && !current.started_at) {
      update.started_at = new Date().toISOString();
    }

    if (body.status === "completed") {
      update.completed_at = new Date().toISOString();
    }

    if (body.status !== "completed") {
      update.completed_at = null;
    }
  }

  if (body.priority !== undefined) {
    if (!priorities.has(body.priority)) {
      return NextResponse.json(
        { message: "검사 우선순위가 올바르지 않습니다." },
        { status: 400 },
      );
    }
    update.priority = body.priority;
  }

  if (body.scheduledAt !== undefined) {
    update.scheduled_at = body.scheduledAt || null;
  }

  if (body.clinicalNote !== undefined) {
    update.clinical_note =
      String(body.clinicalNote ?? "").trim() || null;
  }

  if (body.interpretation !== undefined) {
    update.interpretation =
      String(body.interpretation ?? "").trim() || null;
  }

  if (body.internalNote !== undefined) {
    update.internal_note =
      String(body.internalNote ?? "").trim() || null;
  }

  if (body.guardianSummary !== undefined) {
    update.guardian_summary =
      String(body.guardianSummary ?? "").trim() || null;
  }

  if (body.isGuardianVisible !== undefined) {
    update.is_guardian_visible = body.isGuardianVisible;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json(
      { message: "변경할 항목이 없습니다." },
      { status: 400 },
    );
  }

  const { data, error } = await supabaseAdmin
    .from("diagnostic_orders")
    .update(update)
    .eq("id", diagnosticId)
    .eq("hospital_id", context.hospitalId)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json(
      { message: error.message },
      { status: 500 },
    );
  }

  await supabaseAdmin.from("diagnostic_audit_logs").insert({
    hospital_id: context.hospitalId,
    diagnostic_order_id: diagnosticId,
    actor_user_id: context.userId,
    action: "diagnostic_updated",
    before_data: current,
    after_data: data,
  });

  return NextResponse.json({
    success: true,
    diagnostic: data,
  });
}

export async function DELETE(
  request: Request,
  {
    params,
  }: {
    params: Promise<{ diagnosticId: string }>;
  },
) {
  const context = await requireHospitalDiagnosticContext(request);

  if (isHospitalDiagnosticAuthError(context)) {
    return NextResponse.json(
      { message: context.error },
      { status: context.status },
    );
  }

  const { diagnosticId: diagnosticIdParam } = await params;
  const diagnosticId = Number(diagnosticIdParam);

  if (!Number.isInteger(diagnosticId)) {
    return NextResponse.json(
      { message: "검사 번호가 올바르지 않습니다." },
      { status: 400 },
    );
  }

  const { data: current, error: currentError } = await supabaseAdmin
    .from("diagnostic_orders")
    .select("*")
    .eq("id", diagnosticId)
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
      { message: "삭제할 검사 기록을 찾을 수 없습니다." },
      { status: 404 },
    );
  }

  const { data: files } = await supabaseAdmin
    .from("diagnostic_files")
    .select("storage_bucket,storage_path")
    .eq("diagnostic_order_id", diagnosticId);

  for (const file of files ?? []) {
    await supabaseAdmin.storage
      .from(file.storage_bucket)
      .remove([file.storage_path]);
  }

  const { error } = await supabaseAdmin
    .from("diagnostic_orders")
    .delete()
    .eq("id", diagnosticId)
    .eq("hospital_id", context.hospitalId);

  if (error) {
    return NextResponse.json(
      { message: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({
    success: true,
    deletedDiagnosticId: diagnosticId,
  });
}
