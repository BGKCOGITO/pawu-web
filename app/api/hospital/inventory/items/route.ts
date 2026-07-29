import { NextResponse } from "next/server";
import { requireInventoryAccess } from "../../../../../lib/v6-inventory-access";

export async function GET(request: Request) {
  const auth = await requireInventoryAccess(request, "view_inventory");
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  const { data, error } = await auth.supabaseAdmin
    .from("inventory_items")
    .select("*")
    .eq("hospital_id", auth.access.hospitalId)
    .order("category")
    .order("name");

  if (error) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, items: data ?? [] });
}

export async function POST(request: Request) {
  const auth = await requireInventoryAccess(request, "manage_inventory");
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  const body = await request.json();
  const name = String(body.name ?? "").trim();
  const category = String(body.category ?? "").trim();
  const unit = String(body.unit ?? "").trim();

  if (!name || !category || !unit) {
    return NextResponse.json(
      { ok: false, message: "품목명, 분류, 단위를 입력해 주세요." },
      { status: 400 },
    );
  }

  const { data, error } = await auth.supabaseAdmin
    .from("inventory_items")
    .insert({
      hospital_id: auth.access.hospitalId,
      name,
      category,
      unit,
      sku: String(body.sku ?? "").trim() || null,
      barcode: String(body.barcode ?? "").trim() || null,
      manufacturer: String(body.manufacturer ?? "").trim() || null,
      supplier_name: String(body.supplierName ?? "").trim() || null,
      storage_location: String(body.storageLocation ?? "").trim() || null,
      minimum_quantity: Math.max(0, Number(body.minimumQuantity) || 0),
      management_type: ["general", "expiry", "lot", "strict"].includes(
        String(body.managementType),
      )
        ? body.managementType
        : "general",
      requires_reason: body.requiresReason === true,
      memo: String(body.memo ?? "").trim() || null,
      reorder_quantity: Math.max(0, Number(body.reorderQuantity) || 0),
      expiry_warning_days: Math.max(1, Number(body.expiryWarningDays) || 60),
      regulatory_type: ["general","prescription","controlled","narcotic"].includes(String(body.regulatoryType)) ? body.regulatoryType : "general",
      auto_deduct_enabled: body.autoDeductEnabled !== false,
      created_by: auth.user.id,
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, item: data });
}

export async function PATCH(request: Request) {
  const auth = await requireInventoryAccess(request, "manage_inventory");
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  const body = await request.json();
  const id = Number(body.id);
  if (!Number.isInteger(id)) {
    return NextResponse.json({ ok: false, message: "품목 정보가 올바르지 않습니다." }, { status: 400 });
  }

  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
  const mappings: Record<string, string> = {
    name: "name",
    category: "category",
    unit: "unit",
    sku: "sku",
    barcode: "barcode",
    manufacturer: "manufacturer",
    supplierName: "supplier_name",
    storageLocation: "storage_location",
    minimumQuantity: "minimum_quantity",
    managementType: "management_type",
    requiresReason: "requires_reason",
    isActive: "is_active",
    memo: "memo",
    reorderQuantity: "reorder_quantity",
    expiryWarningDays: "expiry_warning_days",
    regulatoryType: "regulatory_type",
    autoDeductEnabled: "auto_deduct_enabled",
  };

  for (const [source, target] of Object.entries(mappings)) {
    if (body[source] !== undefined) payload[target] = body[source];
  }

  const { error } = await auth.supabaseAdmin
    .from("inventory_items")
    .update(payload)
    .eq("id", id)
    .eq("hospital_id", auth.access.hospitalId);

  if (error) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
