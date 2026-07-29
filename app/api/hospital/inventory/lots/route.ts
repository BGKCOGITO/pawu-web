import { NextResponse } from "next/server";
import { requireInventoryAccess } from "../../../../../lib/v6-inventory-access";

export async function GET(request: Request) {
  const auth = await requireInventoryAccess(request, "view_inventory");
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  const url = new URL(request.url);
  const itemId = Number(url.searchParams.get("itemId"));

  let query = auth.supabaseAdmin
    .from("inventory_lots")
    .select(`
      id, inventory_item_id, lot_number, expires_on, received_on,
      received_quantity, remaining_quantity, unit_cost, supplier_name,
      inventory_items!inner(name, unit, hospital_id)
    `)
    .eq("inventory_items.hospital_id", auth.access.hospitalId)
    .order("expires_on", { ascending: true, nullsFirst: false });

  if (Number.isInteger(itemId)) query = query.eq("inventory_item_id", itemId);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, lots: data ?? [] });
}

export async function POST(request: Request) {
  const auth = await requireInventoryAccess(request, "adjust_inventory");
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  const body = await request.json();
  const itemId = Number(body.itemId);
  const quantity = Number(body.quantity);
  const lotNumber = String(body.lotNumber ?? "").trim();

  if (!Number.isInteger(itemId) || quantity <= 0 || !lotNumber) {
    return NextResponse.json(
      { ok: false, message: "품목, 로트번호, 입고 수량을 확인해 주세요." },
      { status: 400 },
    );
  }

  const { data: item } = await auth.supabaseAdmin
    .from("inventory_items")
    .select("id")
    .eq("id", itemId)
    .eq("hospital_id", auth.access.hospitalId)
    .maybeSingle();

  if (!item) {
    return NextResponse.json({ ok: false, message: "품목을 찾지 못했습니다." }, { status: 404 });
  }

  const { data: lot, error: lotError } = await auth.supabaseAdmin
    .from("inventory_lots")
    .insert({
      inventory_item_id: itemId,
      lot_number: lotNumber,
      expires_on: body.expiresOn || null,
      received_on: body.receivedOn || new Date().toISOString().slice(0, 10),
      received_quantity: quantity,
      remaining_quantity: quantity,
      unit_cost: body.unitCost ?? null,
      supplier_name: String(body.supplierName ?? "").trim() || null,
      created_by: auth.user.id,
    })
    .select("id")
    .single();

  if (lotError || !lot) {
    return NextResponse.json(
      { ok: false, message: lotError?.message ?? "로트를 생성하지 못했습니다." },
      { status: 400 },
    );
  }

  const { error: movementError } = await auth.supabaseAdmin.rpc(
    "pawu_apply_inventory_movement",
    {
      p_hospital_id: auth.access.hospitalId,
      p_inventory_item_id: itemId,
      p_movement_type: "receive",
      p_quantity_change: quantity,
      p_reason: "로트 입고",
      p_reference_type: "inventory_lot",
      p_reference_id: lot.id,
      p_lot_id: lot.id,
      p_unit_cost: body.unitCost ?? null,
      p_actor_user_id: auth.user.id,
    },
  );

  if (movementError) {
    await auth.supabaseAdmin.from("inventory_lots").delete().eq("id", lot.id);
    return NextResponse.json({ ok: false, message: movementError.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, lotId: lot.id });
}
