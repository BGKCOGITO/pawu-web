import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireHospitalContext } from "@/lib/hospital-api-auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ patientId: string }> },
) {
  const context = await requireHospitalContext(request);
  if ("error" in context) {
    return NextResponse.json({ message: context.error }, { status: context.status });
  }

  const { patientId: patientIdParam } = await params;
  const patientId = Number(patientIdParam);

  if (!Number.isInteger(patientId)) {
    return NextResponse.json({ message: "환자번호가 올바르지 않습니다." }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("hospital_patients")
    .select(`
      id,hospital_id,pet_id,patient_number,memo,last_visit_at,created_at,updated_at,
      pets(
        id,name,species,breed,birth_date,gender,weight_kg,notes,user_id,
        pet_lifestyle_profiles(
          food_brand,food_product,feeding_type,feeding_times_per_day,
          feeding_amount_per_day_g,allergies,current_medications,
          supplements,neutered,living_environment,notes,
          pet_food_brands(name_ko),
          pet_food_products(name_ko)
        )
      ),
      medical_records(
        id,reservation_id,chief_complaint,diagnosis,status,completed_at,created_at
      )
    `)
    .eq("id", patientId)
    .eq("hospital_id", context.hospitalId)
    .maybeSingle();

  if (error) return NextResponse.json({ message: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ message: "환자를 찾을 수 없습니다." }, { status: 404 });

  const { data: latestReservation } = await supabaseAdmin
    .from("reservations")
    .select("id,guardian_name,phone,reservation_date,reservation_time,status")
    .eq("hospital_id", context.hospitalId)
    .eq("pet_id", (data as any).pet_id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return NextResponse.json({ patient: data, latestReservation });
}
