import { NextResponse } from "next/server";
import { getAuthUser } from "../../../../lib/v5-access";
import { supabaseAdmin } from "../../../../lib/supabase-admin";

export async function GET(request: Request) {
  const user = await getAuthUser(request);

  if (!user) {
    return NextResponse.json(
      { ok: false, message: "로그인이 필요합니다." },
      { status: 401 },
    );
  }

  const url = new URL(request.url);
  const petId = Number(url.searchParams.get("petId"));

  let query = supabaseAdmin
    .from("medication_orders")
    .select(`
      id, pet_id, diagnosis_summary, guardian_note,
      start_date, end_date, finalized_at,
      hospitals(name, phone, address),
      pets!inner(id, name, user_id),
      medication_order_items(
        id, medication_name, dose_amount, dose_unit,
        route, frequency, duration_days, total_quantity,
        instructions, warning_note, sort_order
      )
    `)
    .eq("pets.user_id", user.id)
    .eq("status", "finalized")
    .eq("guardian_visible", true)
    .order("finalized_at", { ascending: false });

  if (Number.isInteger(petId)) query = query.eq("pet_id", petId);

  const { data, error } = await query;

  if (error) {
    return NextResponse.json(
      { ok: false, message: error.message },
      { status: 400 },
    );
  }

  return NextResponse.json({ ok: true, prescriptions: data ?? [] });
}
