import { NextResponse } from "next/server";
import { requireInventoryAccess } from "../../../../../lib/v6-inventory-access";

export async function GET(request: Request) {
  const auth = await requireInventoryAccess(request, "view_inventory");
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  const { data, error } = await auth.supabaseAdmin
    .from("hospital_service_items")
    .select(`
      id, name, category, default_price, is_active,
      service_item_inventory_usage(
        id, inventory_item_id, default_quantity, is_active,
        inventory_items(id, name, unit, current_quantity, is_active)
      )
    `)
    .eq("hospital_id", auth.access.hospitalId)
    .order("category")
    .order("name");

  if (error) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, services: data ?? [] });
}

export async function PUT(request: Request) {
  const auth = await requireInventoryAccess(request, "manage_inventory");
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  const body = (await request.json()) as {
    serviceItemId?: number;
    usages?: Array<{ inventoryItemId?: number; quantity?: number }>;
  };

  const serviceItemId = Number(body.serviceItemId);
  const usages = Array.isArray(body.usages) ? body.usages : [];

  if (!Number.isInteger(serviceItemId)) {
    return NextResponse.json(
      { ok: false, message: "진료 항목 정보가 올바르지 않습니다." },
      { status: 400 },
    );
  }

  const { data: service } = await auth.supabaseAdmin
    .from("hospital_service_items")
    .select("id")
    .eq("id", serviceItemId)
    .eq("hospital_id", auth.access.hospitalId)
    .maybeSingle();

  if (!service) {
    return NextResponse.json(
      { ok: false, message: "해당 병원의 진료 항목을 찾지 못했습니다." },
      { status: 404 },
    );
  }

  const normalized = usages
    .map((usage) => ({
      inventory_item_id: Number(usage.inventoryItemId),
      default_quantity: Number(usage.quantity),
    }))
    .filter(
      (usage) =>
        Number.isInteger(usage.inventory_item_id) &&
        Number.isFinite(usage.default_quantity) &&
        usage.default_quantity > 0,
    );

  if (normalized.length > 0) {
    const inventoryIds = [...new Set(normalized.map((usage) => usage.inventory_item_id))];
    const { data: validItems } = await auth.supabaseAdmin
      .from("inventory_items")
      .select("id")
      .eq("hospital_id", auth.access.hospitalId)
      .eq("is_active", true)
      .in("id", inventoryIds);

    const validIds = new Set((validItems ?? []).map((item) => Number(item.id)));
    if (normalized.some((usage) => !validIds.has(usage.inventory_item_id))) {
      return NextResponse.json(
        { ok: false, message: "다른 병원 또는 중지된 재고 품목이 포함되어 있습니다." },
        { status: 400 },
      );
    }
  }

  const { error: deleteError } = await auth.supabaseAdmin
    .from("service_item_inventory_usage")
    .delete()
    .eq("hospital_service_item_id", serviceItemId);

  if (deleteError) {
    return NextResponse.json({ ok: false, message: deleteError.message }, { status: 400 });
  }

  if (normalized.length > 0) {
    const { error: insertError } = await auth.supabaseAdmin
      .from("service_item_inventory_usage")
      .insert(
        normalized.map((usage) => ({
          hospital_service_item_id: serviceItemId,
          inventory_item_id: usage.inventory_item_id,
          default_quantity: usage.default_quantity,
          is_active: true,
        })),
      );

    if (insertError) {
      return NextResponse.json({ ok: false, message: insertError.message }, { status: 400 });
    }
  }

  return NextResponse.json({ ok: true });
}
