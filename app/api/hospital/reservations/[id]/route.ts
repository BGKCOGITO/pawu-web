import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireHospitalContext } from "@/lib/hospital-api-auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = await requireHospitalContext(request);

  if ("error" in context) {
    return NextResponse.json(
      { message: context.error },
      { status: context.status },
    );
  }

  const { id } = await params;
  const reservationId = Number(id);

  if (!Number.isInteger(reservationId)) {
    return NextResponse.json(
      { message: "예약번호가 올바르지 않습니다." },
      { status: 400 },
    );
  }

  const { data, error } = await supabaseAdmin
    .from("reservations")
    .select(`
      id,hospital_id,pet_id,pet_name,guardian_name,phone,
      reservation_date,reservation_time,visit_reason,symptoms,status,created_at,
      pets(
        id,name,species,breed,birth_date,gender,weight_kg,notes,
        pet_lifestyle_profiles(
          food_brand,food_product,feeding_type,feeding_times_per_day,
          feeding_amount_per_day_g,treats,allergies,current_medications,
          supplements,neutered,living_environment,notes,
          pet_food_brands(name_ko),
          pet_food_products(name_ko)
        )
      ),
      hospitals(id,name,address,phone),
      visit_preparations(
        id,main_concern,generated_summary,generated_timeline,
        generated_key_points,generated_at,
        visit_preparation_events(
          sort_order,
          pet_health_events(
            id,occurred_at,event_type,title,severity,priority,
            count_value,note,
            pet_health_event_attachments(
              id,storage_path,file_name,mime_type,media_type,sort_order
            )
          )
        )
      )
    `)
    .eq("id", reservationId)
    .eq("hospital_id", context.hospitalId)
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { message: error.message },
      { status: 500 },
    );
  }

  if (!data) {
    return NextResponse.json(
      { message: "해당 병원의 예약을 찾을 수 없습니다." },
      { status: 404 },
    );
  }

  const reservation = data as any;
  const preparation = Array.isArray(reservation.visit_preparations)
    ? reservation.visit_preparations[0] ?? null
    : reservation.visit_preparations;

  const linkedRows = preparation?.visit_preparation_events ?? [];
  const attachments: any[] = [];

  for (const row of linkedRows) {
    const event = Array.isArray(row.pet_health_events)
      ? row.pet_health_events[0]
      : row.pet_health_events;

    for (const attachment of event?.pet_health_event_attachments ?? []) {
      const { data: signed } = await supabaseAdmin.storage
        .from("pet-health-events")
        .createSignedUrl(attachment.storage_path, 60 * 60);

      attachments.push({
        ...attachment,
        event_id: event.id,
        signed_url: signed?.signedUrl ?? null,
      });
    }
  }

  return NextResponse.json({
    reservation,
    attachments,
  });
}
