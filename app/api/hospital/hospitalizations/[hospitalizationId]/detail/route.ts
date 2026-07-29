import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireHospitalContext } from "@/lib/hospital-api-auth";

export async function GET(
  request: NextRequest,
  {
    params,
  }: {
    params: Promise<{ hospitalizationId: string }>;
  },
) {
  const context = await requireHospitalContext(request);

  if ("error" in context) {
    return NextResponse.json(
      { message: context.error },
      { status: context.status },
    );
  }

  const { hospitalizationId: rawId } = await params;
  const hospitalizationId = Number(rawId);

  if (!Number.isInteger(hospitalizationId)) {
    return NextResponse.json(
      { message: "입원 기록 번호가 올바르지 않습니다." },
      { status: 400 },
    );
  }

  const { data, error } = await supabaseAdmin
    .from("hospitalizations")
    .select(`
      *,
      hospitals(
        id,
        name,
        address,
        phone
      ),
      hospital_patients(
        id,
        patient_number,
        pets(
          id,
          name,
          species,
          breed,
          gender,
          weight_kg,
          birth_date
        ),
        reservations!hospital_patients_first_reservation_id_fkey(
          guardian_name,
          phone
        )
      )
    `)
    .eq("id", hospitalizationId)
    .eq("hospital_id", context.hospitalId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json(
      { message: "입원 기록을 찾을 수 없습니다." },
      { status: 404 },
    );
  }

  return NextResponse.json({ hospitalization: data });
}
