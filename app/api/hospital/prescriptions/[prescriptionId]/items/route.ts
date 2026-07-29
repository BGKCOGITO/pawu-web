import { NextResponse } from "next/server";
import { requirePrescriptionAccess } from "../../../../../../lib/v6-5-prescription-access";

export async function POST(
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

  const { data: prescription } = await auth.supabaseAdmin
    .from("medication_orders")
    .select("id, status")
    .eq("id", id)
    .eq("hospital_id", auth.access.hospitalId)
    .maybeSingle();

  if (!prescription || prescription.status !== "draft") {
    return NextResponse.json(
      { ok: false, message: "처방 항목을 추가할 수 없는 상태입니다." },
      { status: 409 },
    );
  }

  const medicationName = String(body.medicationName ?? "").trim();
  const doseAmount = body.doseAmount === "" ? null : Number(body.doseAmount);
  const doseUnit = String(body.doseUnit ?? "").trim();
  const route = String(body.route ?? "").trim();
  const frequency = String(body.frequency ?? "").trim();

  if (
    !medicationName ||
    doseAmount == null ||
    !Number.isFinite(doseAmount) ||
    !doseUnit ||
    !route ||
    !frequency
  ) {
    return NextResponse.json(
      {
        ok: false,
        message: "약품명, 1회 용량, 단위, 투여경로, 횟수를 확인해 주세요.",
      },
      { status: 400 },
    );
  }

  if (doseAmount <= 0) {
    return NextResponse.json(
      { ok: false, message: "1회 용량은 0보다 커야 합니다." },
      { status: 400 },
    );
  }

  const durationDays =
    body.durationDays === "" || body.durationDays == null
      ? null
      : Number(body.durationDays);
  const totalQuantity =
    body.totalQuantity === "" || body.totalQuantity == null
      ? null
      : Number(body.totalQuantity);

  if (durationDays != null && (!Number.isFinite(durationDays) || durationDays <= 0)) {
    return NextResponse.json(
      { ok: false, message: "복약 기간은 1일 이상이어야 합니다." },
      { status: 400 },
    );
  }

  if (totalQuantity != null && (!Number.isFinite(totalQuantity) || totalQuantity <= 0)) {
    return NextResponse.json(
      { ok: false, message: "총 처방량은 0보다 커야 합니다." },
      { status: 400 },
    );
  }

  const { error } = await auth.supabaseAdmin
    .from("medication_order_items")
    .insert({
      medication_order_id: id,
      medication_name: medicationName,
      active_ingredient: String(body.activeIngredient ?? "").trim() || null,
      inventory_item_id: body.inventoryItemId ? Number(body.inventoryItemId) : null,
      central_medication_id: body.centralMedicationId
        ? Number(body.centralMedicationId)
        : null,
      hospital_medication_id: body.hospitalMedicationId
        ? Number(body.hospitalMedicationId)
        : null,
      product_strength_snapshot:
        String(body.productStrengthSnapshot ?? "").trim() || null,
      dosage_form_snapshot:
        String(body.dosageFormSnapshot ?? "").trim() || null,
      manufacturer_snapshot:
        String(body.manufacturerSnapshot ?? "").trim() || null,
      dose_amount: doseAmount,
      dose_unit: doseUnit,
      route,
      frequency,
      duration_days: durationDays,
      total_quantity: totalQuantity,
      instructions: String(body.instructions ?? "").trim() || null,
      warning_note: String(body.warningNote ?? "").trim() || null,
      sort_order: Number(body.sortOrder) || 0,
    });

  if (error) {
    return NextResponse.json(
      { ok: false, message: error.message },
      { status: 400 },
    );
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(
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
  const itemId = Number(body.itemId);

  const { data: prescription } = await auth.supabaseAdmin
    .from("medication_orders")
    .select("id, status")
    .eq("id", id)
    .eq("hospital_id", auth.access.hospitalId)
    .maybeSingle();

  if (!prescription || prescription.status !== "draft") {
    return NextResponse.json(
      { ok: false, message: "처방 항목을 삭제할 수 없는 상태입니다." },
      { status: 409 },
    );
  }

  const { error } = await auth.supabaseAdmin
    .from("medication_order_items")
    .delete()
    .eq("id", itemId)
    .eq("medication_order_id", id);

  if (error) {
    return NextResponse.json(
      { ok: false, message: error.message },
      { status: 400 },
    );
  }

  return NextResponse.json({ ok: true });
}
