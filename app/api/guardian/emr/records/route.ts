import { NextResponse } from "next/server";
import { getAuthUser } from "../../../../../lib/v5-access";
import { supabaseAdmin } from "../../../../../lib/supabase-admin";

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
    .from("emr_records")
    .select(`
      id, pet_id, status, diagnosis_summary, treatment_summary,
      guardian_summary, follow_up_date, finalized_at, created_at,
      hospitals(name, phone, address),
      pets!inner(id, name, user_id),
      emr_prescriptions(
        id, medication_name, dosage, unit, frequency,
        duration_days, route, instructions
      ),
      emr_followups(
        id, follow_up_type, due_date, title, note, status
      )
    `)
    .eq("pets.user_id", user.id)
    .eq("status", "finalized")
    .order("finalized_at", { ascending: false });

  if (Number.isInteger(petId)) {
    query = query.eq("pet_id", petId);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json(
      { ok: false, message: error.message },
      { status: 400 },
    );
  }

  return NextResponse.json({ ok: true, records: data ?? [] });
}
