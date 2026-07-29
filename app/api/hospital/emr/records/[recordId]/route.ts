import { NextResponse } from "next/server";
import { requireEmrEditorAccess } from "../../../../../../lib/v6-5-5a-emr-access";

export async function GET(
  request: Request,
  context: { params: Promise<{ recordId: string }> },
) {
  const auth = await requireEmrEditorAccess(request, "view");

  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, message: auth.message },
      { status: auth.status },
    );
  }

  const { recordId } = await context.params;
  const id = Number(recordId);

  const { data, error } = await auth.supabaseAdmin
    .from("emr_records")
    .select(`
      *,
      pets(id, name, species, breed, gender, birth_date, weight_kg, notes),
      reservations(
        id, reservation_date, reservation_time, visit_reason,
        symptoms, guardian_name, phone, status
      )
    `)
    .eq("id", id)
    .eq("hospital_id", auth.access.hospitalId)
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json(
      { ok: false, message: error?.message ?? "차트를 찾지 못했습니다." },
      { status: 404 },
    );
  }

  const [prescriptions, labs, history, auditLogs] = await Promise.all([
    auth.supabaseAdmin
      .from("medication_orders")
      .select("id, status, diagnosis_summary, start_date, end_date, created_at")
      .eq("hospital_id", auth.access.hospitalId)
      .eq("pet_id", data.pet_id)
      .order("created_at", { ascending: false })
      .limit(10),
    auth.supabaseAdmin
      .from("lab_orders")
      .select("id, status, test_name, ordered_at, completed_at")
      .eq("hospital_id", auth.access.hospitalId)
      .eq("pet_id", data.pet_id)
      .order("ordered_at", { ascending: false })
      .limit(10),
    auth.supabaseAdmin
      .from("emr_records")
      .select("id, status, chief_complaint, subjective, objective, assessment, plan, diagnosis_summary, created_at")
      .eq("hospital_id", auth.access.hospitalId)
      .eq("pet_id", data.pet_id)
      .neq("id", id)
      .order("created_at", { ascending: false })
      .limit(10),
    auth.supabaseAdmin
      .from("emr_audit_logs")
      .select("id, actor_display_name, actor_role, action_type, reason, changed_fields, created_at")
      .eq("hospital_id", auth.access.hospitalId)
      .eq("emr_record_id", id)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  return NextResponse.json({
    ok: true,
    record: data,
    prescriptions: prescriptions.data ?? [],
    labs: labs.error ? [] : labs.data ?? [],
    history: history.data ?? [],
    auditLogs: auditLogs.error ? [] : auditLogs.data ?? [],
    permissions: {
      canWrite: ["owner", "veterinarian", "nurse"].includes(String(auth.access.role ?? "")) || auth.access.permissions?.write_emr === true,
      canFinalize: ["owner", "veterinarian"].includes(String(auth.access.role ?? "")) || auth.access.permissions?.finalize_emr === true,
      canReopen: String(auth.access.role ?? "") === "owner" || auth.access.permissions?.reopen_emr === true,
    },
  });
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ recordId: string }> },
) {
  const auth = await requireEmrEditorAccess(request, "write");

  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, message: auth.message },
      { status: auth.status },
    );
  }

  const { recordId } = await context.params;
  const id = Number(recordId);
  const body = await request.json();

  const { data: current } = await auth.supabaseAdmin
    .from("emr_records")
    .select("id, status")
    .eq("id", id)
    .eq("hospital_id", auth.access.hospitalId)
    .maybeSingle();

  if (!current) {
    return NextResponse.json(
      { ok: false, message: "차트를 찾지 못했습니다." },
      { status: 404 },
    );
  }

  if (current.status === "finalized") {
    return NextResponse.json(
      { ok: false, message: "확정된 차트는 수정할 수 없습니다." },
      { status: 409 },
    );
  }

  const updatedAt = new Date().toISOString();

  const { error } = await auth.supabaseAdmin
    .from("emr_records")
    .update({
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
      updated_by: auth.user.id,
      updated_at: updatedAt,
    })
    .eq("id", id)
    .eq("hospital_id", auth.access.hospitalId);

  if (error) {
    return NextResponse.json(
      { ok: false, message: error.message },
      { status: 400 },
    );
  }

  return NextResponse.json({ ok: true, updatedAt });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ recordId: string }> },
) {
  const body = await request.json();
  const action = String(body.action ?? "");
  const permission = action === "reopen" ? "reopen" : "finalize";
  const auth = await requireEmrEditorAccess(request, permission);

  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, message: auth.message },
      { status: auth.status },
    );
  }

  const { recordId } = await context.params;
  const id = Number(recordId);

  const { data: current } = await auth.supabaseAdmin
    .from("emr_records")
    .select("id, status, pet_id, reservation_id, assessment, plan, diagnosis_summary")
    .eq("id", id)
    .eq("hospital_id", auth.access.hospitalId)
    .maybeSingle();

  if (!current) {
    return NextResponse.json(
      { ok: false, message: "차트를 찾지 못했습니다." },
      { status: 404 },
    );
  }

  if (action === "finalize") {
    if (current.status === "finalized") {
      return NextResponse.json(
        { ok: false, message: "이미 확정된 차트입니다." },
        { status: 409 },
      );
    }

    if (!current.assessment && !current.diagnosis_summary) {
      return NextResponse.json(
        { ok: false, message: "평가 또는 진단 요약을 입력해 주세요." },
        { status: 400 },
      );
    }

    if (!current.plan) {
      return NextResponse.json(
        { ok: false, message: "치료 계획을 입력해 주세요." },
        { status: 400 },
      );
    }

    const { error } = await auth.supabaseAdmin
      .from("emr_records")
      .update({
        status: "finalized",
        finalized_at: new Date().toISOString(),
        finalized_by: auth.user.id,
        updated_by: auth.user.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("hospital_id", auth.access.hospitalId);

    if (error) {
      return NextResponse.json(
        { ok: false, message: error.message },
        { status: 400 },
      );
    }

    if (current.reservation_id) {
      await auth.supabaseAdmin
        .from("reservations")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
        })
        .eq("id", current.reservation_id)
        .eq("hospital_id", auth.access.hospitalId);
    }

    return NextResponse.json({ ok: true, status: "finalized" });
  }

  if (action === "reopen") {
    const reason = String(body.reason ?? "").trim();

    if (!reason) {
      return NextResponse.json(
        { ok: false, message: "재개 사유를 입력해 주세요." },
        { status: 400 },
      );
    }

    const { error } = await auth.supabaseAdmin
      .from("emr_records")
      .update({
        status: "draft",
        finalized_at: null,
        finalized_by: null,
        reopen_reason: reason,
        updated_by: auth.user.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("hospital_id", auth.access.hospitalId);

    if (error) {
      return NextResponse.json(
        { ok: false, message: error.message },
        { status: 400 },
      );
    }

    return NextResponse.json({ ok: true, status: "draft" });
  }

  return NextResponse.json(
    { ok: false, message: "처리 방식이 올바르지 않습니다." },
    { status: 400 },
  );
}
