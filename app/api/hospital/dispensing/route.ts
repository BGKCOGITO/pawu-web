import { NextResponse } from "next/server";
import { requireDispensingAccess } from "../../../../lib/v6-5-5-dispensing-access";

export async function GET(request: Request) {
  const auth = await requireDispensingAccess(request, "view");

  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, message: auth.message },
      { status: auth.status },
    );
  }

  const url = new URL(request.url);
  const status = url.searchParams.get("status");
  const petId = Number(url.searchParams.get("petId"));

  let query = auth.supabaseAdmin
    .from("dispensing_jobs")
    .select(`
      id, hospital_id, medication_order_id, pet_id, status,
      priority, queued_at, started_at, completed_at, completed_by,
      guardian_instruction_snapshot, completion_note,
      pets(id, name, species, breed, weight_kg),
      medication_orders(id, diagnosis_summary, start_date, end_date),
      dispensing_items(
        id, medication_order_item_id, medication_name,
        inventory_item_id, requested_quantity, quantity_unit,
        dispensed_quantity, lot_id, status, warning_note,
        inventory_items(id, name, current_quantity, minimum_quantity, unit),
        inventory_lots(id, lot_number, expires_on, remaining_quantity)
      )
    `)
    .eq("hospital_id", auth.access.hospitalId)
    .order("priority", { ascending: false })
    .order("queued_at", { ascending: true })
    .limit(200);

  if (status) query = query.eq("status", status);
  if (Number.isInteger(petId)) query = query.eq("pet_id", petId);

  const { data, error } = await query;

  if (error) {
    return NextResponse.json(
      { ok: false, message: error.message },
      { status: 400 },
    );
  }

  return NextResponse.json({ ok: true, jobs: data ?? [] });
}
