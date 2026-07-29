import { NextResponse } from "next/server";
import { requireDispensingAccess } from "../../../../../lib/v6-5-5-dispensing-access";

export async function GET(
  request: Request,
  context: { params: Promise<{ jobId: string }> },
) {
  const auth = await requireDispensingAccess(request, "view");

  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, message: auth.message },
      { status: auth.status },
    );
  }

  const { jobId } = await context.params;
  const id = Number(jobId);

  const { data, error } = await auth.supabaseAdmin
    .from("dispensing_jobs")
    .select(`
      *,
      pets(id, name, species, breed, gender, birth_date, weight_kg),
      medication_orders(
        id, diagnosis_summary, guardian_note, start_date, end_date,
        finalized_at, status
      ),
      dispensing_items(
        id, medication_order_item_id, medication_name,
        inventory_item_id, requested_quantity, quantity_unit,
        dispensed_quantity, lot_id, status, warning_note,
        inventory_items(
          id, name, current_quantity, minimum_quantity,
          unit, management_type, storage_location
        ),
        inventory_lots(
          id, lot_number, expires_on, remaining_quantity
        )
      )
    `)
    .eq("id", id)
    .eq("hospital_id", auth.access.hospitalId)
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json(
      { ok: false, message: error?.message ?? "조제 작업을 찾지 못했습니다." },
      { status: 404 },
    );
  }

  return NextResponse.json({ ok: true, job: data });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ jobId: string }> },
) {
  const auth = await requireDispensingAccess(request, "dispense");

  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, message: auth.message },
      { status: auth.status },
    );
  }

  const { jobId } = await context.params;
  const id = Number(jobId);
  const body = await request.json();
  const action = String(body.action ?? "");

  if (action === "start") {
    const { error } = await auth.supabaseAdmin
      .from("dispensing_jobs")
      .update({
        status: "in_progress",
        started_at: new Date().toISOString(),
        started_by: auth.user.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("hospital_id", auth.access.hospitalId)
      .eq("status", "queued");

    if (error) {
      return NextResponse.json(
        { ok: false, message: error.message },
        { status: 400 },
      );
    }

    return NextResponse.json({ ok: true, status: "in_progress" });
  }

  if (action === "complete") {
    const items = Array.isArray(body.items) ? body.items : [];
    const completionNote = String(body.completionNote ?? "").trim() || null;

    const { data, error } = await auth.supabaseAdmin.rpc(
      "pawu_complete_dispensing_job",
      {
        p_hospital_id: auth.access.hospitalId,
        p_dispensing_job_id: id,
        p_actor_user_id: auth.user.id,
        p_completion_note: completionNote,
        p_items: items,
      },
    );

    if (error) {
      return NextResponse.json(
        { ok: false, message: error.message },
        { status: 400 },
      );
    }

    return NextResponse.json({ ok: true, result: data });
  }

  if (action === "cancel") {
    const reason = String(body.reason ?? "").trim();

    if (!reason) {
      return NextResponse.json(
        { ok: false, message: "취소 사유를 입력해 주세요." },
        { status: 400 },
      );
    }

    const { error } = await auth.supabaseAdmin
      .from("dispensing_jobs")
      .update({
        status: "cancelled",
        cancellation_reason: reason,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("hospital_id", auth.access.hospitalId)
      .in("status", ["queued", "in_progress"]);

    if (error) {
      return NextResponse.json(
        { ok: false, message: error.message },
        { status: 400 },
      );
    }

    return NextResponse.json({ ok: true, status: "cancelled" });
  }

  return NextResponse.json(
    { ok: false, message: "처리 방식이 올바르지 않습니다." },
    { status: 400 },
  );
}
