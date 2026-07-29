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
    .from("inventory_movements")
    .select(`
      id, movement_type, quantity_change, quantity_before, quantity_after,
      reason, reference_type, reference_id, created_at,
      inventory_items!inner(id, name, hospital_id, unit),
      profiles(display_name)
    `)
    .eq("inventory_items.hospital_id", auth.access.hospitalId)
    .order("created_at", { ascending: false })
    .limit(200);

  if (Number.isInteger(itemId)) {
    query = query.eq("inventory_item_id", itemId);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, movements: data ?? [] });
}

export async function POST(request: Request) {
  const auth = await requireInventoryAccess(request, "adjust_inventory");
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  const body = await request.json();
  const itemId = Number(body.itemId);
  const movementType = String(body.movementType ?? "");
  const quantity = Number(body.quantity);
  const reason = String(body.reason ?? "").trim();

  if (
    !Number.isInteger(itemId) ||
    !["receive", "use", "waste", "adjust", "return"].includes(movementType) ||
    !Number.isFinite(quantity) ||
    quantity <= 0
  ) {
    return NextResponse.json(
      { ok: false, message: "입출고 정보를 확인해 주세요." },
      { status: 400 },
    );
  }

  const { data: item } = await auth.supabaseAdmin
    .from("inventory_items")
    .select("requires_reason")
    .eq("id", itemId)
    .eq("hospital_id", auth.access.hospitalId)
    .maybeSingle();

  if (!item) {
    return NextResponse.json({ ok: false, message: "품목을 찾지 못했습니다." }, { status: 404 });
  }

  if (item.requires_reason && !reason) {
    return NextResponse.json(
      { ok: false, message: "이 품목은 변경 사유가 필수입니다." },
      { status: 400 },
    );
  }

  const signedQuantity =
    movementType === "receive" || movementType === "return"
      ? Math.abs(quantity)
      : movementType === "adjust"
        ? Number(body.adjustmentDirection) === 1
          ? Math.abs(quantity)
          : -Math.abs(quantity)
        : -Math.abs(quantity);

  const { data, error } = await auth.supabaseAdmin.rpc("pawu_apply_inventory_movement", {
    p_hospital_id: auth.access.hospitalId,
    p_inventory_item_id: itemId,
    p_movement_type: movementType,
    p_quantity_change: signedQuantity,
    p_reason: reason || null,
    p_reference_type: body.referenceType ?? null,
    p_reference_id: body.referenceId ?? null,
    p_lot_id: body.lotId ?? null,
    p_unit_cost: body.unitCost ?? null,
    p_actor_user_id: auth.user.id,
  });

  if (error) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, result: data });
}
