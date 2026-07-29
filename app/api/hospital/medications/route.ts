import { NextResponse } from "next/server";
import { requirePrescriptionAccess } from "../../../../lib/v6-5-prescription-access";

export async function GET(request: Request) {
  const auth = await requirePrescriptionAccess(request, "view_prescription");
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  const { data, error } = await auth.supabaseAdmin
    .from("hospital_medications")
    .select(`
      id, hospital_alias, inventory_item_id, purchase_unit, stock_unit,
      dispensing_unit, conversion_factor, storage_location, reorder_level,
      notes, is_active,
      central_medications(
        id, product_name_ko, product_name_en, ingredient_name_ko,
        ingredient_name_en, manufacturer_name, dosage_form, strength_text,
        route_hint, medication_category, is_anesthetic, is_controlled,
        approval_status
      )
    `)
    .eq("hospital_id", auth.access.hospitalId)
    .order("is_active", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true, medications: data ?? [] });
}

export async function POST(request: Request) {
  const auth = await requirePrescriptionAccess(request, "write_prescription");
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  const body = await request.json();
  const centralMedicationId = Number(body.centralMedicationId);
  if (!Number.isInteger(centralMedicationId) || centralMedicationId <= 0) {
    return NextResponse.json({ ok: false, message: "약품을 선택해 주세요." }, { status: 400 });
  }

  const { data: master } = await auth.supabaseAdmin
    .from("central_medications")
    .select("id")
    .eq("id", centralMedicationId)
    .maybeSingle();

  if (!master) {
    return NextResponse.json({ ok: false, message: "중앙 약품 DB에서 찾지 못했습니다." }, { status: 404 });
  }

  const payload = {
    hospital_id: auth.access.hospitalId,
    central_medication_id: centralMedicationId,
    hospital_alias: String(body.hospitalAlias ?? "").trim() || null,
    purchase_unit: String(body.purchaseUnit ?? "").trim() || null,
    stock_unit: String(body.stockUnit ?? "").trim() || null,
    dispensing_unit: String(body.dispensingUnit ?? "").trim() || null,
    conversion_factor: body.conversionFactor ? Number(body.conversionFactor) : null,
    storage_location: String(body.storageLocation ?? "").trim() || null,
    reorder_level: body.reorderLevel ? Number(body.reorderLevel) : null,
    notes: String(body.notes ?? "").trim() || null,
    created_by: auth.user.id,
    is_active: true,
  };

  const { data, error } = await auth.supabaseAdmin
    .from("hospital_medications")
    .upsert(payload, { onConflict: "hospital_id,central_medication_id" })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true, hospitalMedicationId: data.id });
}

export async function PATCH(request: Request) {
  const auth = await requirePrescriptionAccess(request, "write_prescription");
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  const body = await request.json();
  const id = Number(body.id);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ ok: false, message: "잘못된 약품 ID입니다." }, { status: 400 });
  }

  const changes: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body.isActive === "boolean") changes.is_active = body.isActive;
  if ("hospitalAlias" in body) changes.hospital_alias = String(body.hospitalAlias ?? "").trim() || null;
  if ("storageLocation" in body) changes.storage_location = String(body.storageLocation ?? "").trim() || null;
  if ("stockUnit" in body) changes.stock_unit = String(body.stockUnit ?? "").trim() || null;
  if ("dispensingUnit" in body) changes.dispensing_unit = String(body.dispensingUnit ?? "").trim() || null;

  const { error } = await auth.supabaseAdmin
    .from("hospital_medications")
    .update(changes)
    .eq("id", id)
    .eq("hospital_id", auth.access.hospitalId);

  if (error) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
