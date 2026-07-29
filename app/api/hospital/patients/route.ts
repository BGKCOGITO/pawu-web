import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireHospitalContext } from "@/lib/hospital-api-auth";

export async function GET(request: NextRequest) {
  const context = await requireHospitalContext(request);

  if ("error" in context) {
    return NextResponse.json({ message: context.error }, { status: context.status });
  }

  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";

  let query = supabaseAdmin
    .from("hospital_patients")
    .select(`
      id,hospital_id,pet_id,patient_number,memo,last_visit_at,created_at,updated_at,
      pets(id,name,species,breed,birth_date,gender,weight_kg,user_id),
      reservations!hospital_patients_first_reservation_id_fkey(
        guardian_name,phone
      )
    `)
    .eq("hospital_id", context.hospitalId)
    .order("updated_at", { ascending: false });

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  const rows = (data ?? []).filter((row: any) => {
    if (!q) return true;
    const pet = Array.isArray(row.pets) ? row.pets[0] : row.pets;
    const reservation = Array.isArray(row.reservations)
      ? row.reservations[0]
      : row.reservations;
    const haystack = [
      pet?.name,
      pet?.breed,
      reservation?.guardian_name,
      reservation?.phone,
      row.patient_number,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return haystack.includes(q.toLowerCase());
  });

  return NextResponse.json({ patients: rows });
}
