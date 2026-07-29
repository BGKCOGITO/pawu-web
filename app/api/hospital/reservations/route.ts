import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireHospitalContext } from "@/lib/hospital-api-auth";

export async function GET(request: NextRequest) {
  const context = await requireHospitalContext(request);

  if ("error" in context) {
    return NextResponse.json(
      { message: context.error },
      { status: context.status },
    );
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") ?? "all";
  const q = searchParams.get("q")?.trim() ?? "";

  let query = supabaseAdmin
    .from("reservations")
    .select(`
      id,hospital_id,pet_id,pet_name,guardian_name,phone,
      reservation_date,reservation_time,visit_reason,symptoms,status,created_at,
      pets(id,name,species,breed,gender,weight_kg),
      visit_preparations(
        id,main_concern,generated_summary,
        visit_preparation_events(
          pet_health_events(priority)
        )
      )
    `)
    .eq("hospital_id", context.hospitalId)
    .order("reservation_date", { ascending: false })
    .order("reservation_time", { ascending: false });

  if (status !== "all") {
    query = query.eq("status", status);
  }

  if (q) {
    query = query.or(
      `pet_name.ilike.%${q}%,guardian_name.ilike.%${q}%,phone.ilike.%${q}%`,
    );
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json(
      { message: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ reservations: data ?? [] });
}
