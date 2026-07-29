import { NextResponse } from "next/server";
import { requirePrescriptionAccess } from "../../../../../lib/v6-5-prescription-access";

export async function GET(
  request: Request,
  context: { params: Promise<{ prescriptionId: string }> },
) {
  const auth = await requirePrescriptionAccess(request, "view_prescription");

  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, message: auth.message },
      { status: auth.status },
    );
  }

  const { prescriptionId } = await context.params;
  const id = Number(prescriptionId);

  const { data, error } = await auth.supabaseAdmin
    .from("medication_orders")
    .select(`
      *,
      pets(id, name, species, breed, birth_date, gender, weight_kg),
      emr_records(id, chief_complaint, diagnosis_summary, status),
      medication_order_items(
        id, medication_name, active_ingredient,
        inventory_item_id, central_medication_id, hospital_medication_id,
        product_strength_snapshot, dosage_form_snapshot, manufacturer_snapshot,
        dose_amount, dose_unit, route, frequency, duration_days, total_quantity,
        instructions, warning_note, sort_order,
        inventory_items(id, name, unit, current_quantity)
      )
    `)
    .eq("id", id)
    .eq("hospital_id", auth.access.hospitalId)
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json(
      { ok: false, message: error?.message ?? "처방전을 찾지 못했습니다." },
      { status: 404 },
    );
  }

  return NextResponse.json({ ok: true, prescription: data });
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ prescriptionId: string }> },
) {
  const auth = await requirePrescriptionAccess(request, "write_prescription");

  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, message: auth.message },
      { status: auth.status },
    );
  }

  const { prescriptionId } = await context.params;
  const id = Number(prescriptionId);
  const body = await request.json();

  const { data: current } = await auth.supabaseAdmin
    .from("medication_orders")
    .select("id, status")
    .eq("id", id)
    .eq("hospital_id", auth.access.hospitalId)
    .maybeSingle();

  if (!current) {
    return NextResponse.json(
      { ok: false, message: "처방전을 찾지 못했습니다." },
      { status: 404 },
    );
  }

  if (current.status === "finalized") {
    return NextResponse.json(
      { ok: false, message: "확정된 처방전은 직접 수정할 수 없습니다." },
      { status: 409 },
    );
  }

  const { error } = await auth.supabaseAdmin
    .from("medication_orders")
    .update({
      diagnosis_summary: String(body.diagnosisSummary ?? "").trim() || null,
      guardian_note: String(body.guardianNote ?? "").trim() || null,
      start_date: String(body.startDate ?? "").trim() || null,
      end_date: String(body.endDate ?? "").trim() || null,
      guardian_visible: body.guardianVisible === true,
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

  return NextResponse.json({ ok: true });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ prescriptionId: string }> },
) {
  const auth = await requirePrescriptionAccess(request, "finalize_prescription");

  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, message: auth.message },
      { status: auth.status },
    );
  }

  const { prescriptionId } = await context.params;
  const id = Number(prescriptionId);
  const body = await request.json();

  if (!["finalize", "reopen", "cancel"].includes(String(body.action))) {
    return NextResponse.json(
      { ok: false, message: "처리 방식이 올바르지 않습니다." },
      { status: 400 },
    );
  }

  if (body.action === "finalize") {
    const { data: prescription } = await auth.supabaseAdmin
      .from("medication_orders")
      .select(`
        id, status, guardian_visible, guardian_note,
        medication_order_items(id, medication_name, dose_amount, dose_unit, route, frequency)
      `)
      .eq("id", id)
      .eq("hospital_id", auth.access.hospitalId)
      .maybeSingle();

    if (!prescription) {
      return NextResponse.json(
        { ok: false, message: "처방전을 찾지 못했습니다." },
        { status: 404 },
      );
    }

    if (prescription.status === "finalized") {
      return NextResponse.json(
        { ok: false, message: "이미 확정된 처방전입니다." },
        { status: 409 },
      );
    }

    if (!prescription.medication_order_items?.length) {
      return NextResponse.json(
        { ok: false, message: "처방 약품을 하나 이상 추가해 주세요." },
        { status: 400 },
      );
    }

    const invalidItem = prescription.medication_order_items.find(
      (item: any) =>
        !item.medication_name ||
        item.dose_amount == null ||
        !item.dose_unit ||
        !item.route ||
        !item.frequency,
    );

    if (invalidItem) {
      return NextResponse.json(
        {
          ok: false,
          message: "모든 처방 항목의 용량·단위·투여경로·횟수를 입력해 주세요.",
        },
        { status: 400 },
      );
    }

    if (prescription.guardian_visible && !prescription.guardian_note) {
      return NextResponse.json(
        { ok: false, message: "보호자 공개용 복약 안내를 입력해 주세요." },
        { status: 400 },
      );
    }

    const { error } = await auth.supabaseAdmin
      .from("medication_orders")
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

    return NextResponse.json({ ok: true, status: "finalized" });
  }

  if (body.action === "reopen") {
    const reason = String(body.reason ?? "").trim();

    if (!reason) {
      return NextResponse.json(
        { ok: false, message: "재개 사유를 입력해 주세요." },
        { status: 400 },
      );
    }

    const { data, error } = await auth.supabaseAdmin.rpc(
      "pawu_reopen_medication_order",
      {
        p_hospital_id: auth.access.hospitalId,
        p_medication_order_id: id,
        p_actor_user_id: auth.user.id,
        p_reason: reason,
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

  const reason = String(body.reason ?? "").trim();

  if (!reason) {
    return NextResponse.json(
      { ok: false, message: "취소 사유를 입력해 주세요." },
      { status: 400 },
    );
  }

  const { error } = await auth.supabaseAdmin
    .from("medication_orders")
    .update({
      status: "cancelled",
      cancellation_reason: reason,
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

  return NextResponse.json({ ok: true, status: "cancelled" });
}
