import { NextResponse } from "next/server";
import { requirePrescriptionAccess } from "../../../../lib/v6-5-prescription-access";

export async function GET(request: Request) {
  const auth = await requirePrescriptionAccess(request, "view_prescription");

  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, message: auth.message },
      { status: auth.status },
    );
  }

  const { data, error } = await auth.supabaseAdmin
    .from("medication_order_templates")
    .select(`
      id, name, category, is_active, created_at,
      medication_order_template_items(
        id, medication_name, active_ingredient,
        inventory_item_id, dose_amount, dose_unit,
        route, frequency, duration_days, total_quantity,
        instructions, warning_note, sort_order
      )
    `)
    .eq("hospital_id", auth.access.hospitalId)
    .eq("is_active", true)
    .order("name");

  if (error) {
    return NextResponse.json(
      { ok: false, message: error.message },
      { status: 400 },
    );
  }

  return NextResponse.json({ ok: true, templates: data ?? [] });
}

export async function POST(request: Request) {
  const auth = await requirePrescriptionAccess(request, "write_prescription");

  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, message: auth.message },
      { status: auth.status },
    );
  }

  const body = await request.json();
  const name = String(body.name ?? "").trim();

  if (!name) {
    return NextResponse.json(
      { ok: false, message: "템플릿 이름을 입력해 주세요." },
      { status: 400 },
    );
  }

  const items = Array.isArray(body.items) ? body.items : [];

  const { data: template, error } = await auth.supabaseAdmin
    .from("medication_order_templates")
    .insert({
      hospital_id: auth.access.hospitalId,
      name,
      category: String(body.category ?? "").trim() || null,
      is_active: true,
      created_by: auth.user.id,
      updated_by: auth.user.id,
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json(
      { ok: false, message: error.message },
      { status: 400 },
    );
  }

  if (items.length > 0) {
    const rows = items.map((item: any, index: number) => ({
      template_id: template.id,
      medication_name: String(item.medicationName ?? "").trim(),
      active_ingredient: String(item.activeIngredient ?? "").trim() || null,
      inventory_item_id: item.inventoryItemId ? Number(item.inventoryItemId) : null,
      dose_amount: item.doseAmount ? Number(item.doseAmount) : null,
      dose_unit: String(item.doseUnit ?? "").trim() || null,
      route: String(item.route ?? "").trim() || null,
      frequency: String(item.frequency ?? "").trim() || null,
      duration_days: item.durationDays ? Number(item.durationDays) : null,
      total_quantity: item.totalQuantity ? Number(item.totalQuantity) : null,
      instructions: String(item.instructions ?? "").trim() || null,
      warning_note: String(item.warningNote ?? "").trim() || null,
      sort_order: index * 10,
    }));

    const { error: itemError } = await auth.supabaseAdmin
      .from("medication_order_template_items")
      .insert(rows);

    if (itemError) {
      return NextResponse.json(
        { ok: false, message: itemError.message },
        { status: 400 },
      );
    }
  }

  return NextResponse.json({ ok: true, templateId: template.id });
}
