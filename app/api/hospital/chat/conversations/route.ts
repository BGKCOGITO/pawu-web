import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireHospitalContext } from "@/lib/hospital-api-auth";

export async function GET(request: NextRequest) {
  const context = await requireHospitalContext(request);
  if ("error" in context) {
    return NextResponse.json({ message: context.error }, { status: context.status });
  }

  const { data: conversations, error } = await supabaseAdmin
    .from("chat_conversations")
    .select("id,reservation_id,guardian_user_id,pet_id,status,last_message_at,last_message_preview")
    .eq("hospital_id", context.hospitalId)
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .order("id", { ascending: false });

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  const rows = conversations ?? [];
  if (rows.length === 0) return NextResponse.json({ conversations: [] });

  const reservationIds = rows.map((row) => Number(row.reservation_id)).filter(Number.isInteger);
  const petIds = rows.map((row) => Number(row.pet_id)).filter(Number.isInteger);
  const conversationIds = rows.map((row) => Number(row.id));

  const [reservationsResult, petsResult, unreadResult] = await Promise.all([
    reservationIds.length
      ? supabaseAdmin
          .from("reservations")
          .select("id,guardian_name,phone,reservation_date,reservation_time,status")
          .in("id", reservationIds)
      : Promise.resolve({ data: [], error: null }),
    petIds.length
      ? supabaseAdmin.from("pets").select("id,name,species,breed").in("id", petIds)
      : Promise.resolve({ data: [], error: null }),
    supabaseAdmin
      .from("chat_messages")
      .select("conversation_id")
      .in("conversation_id", conversationIds)
      .eq("sender_type", "guardian")
      .is("read_at", null),
  ]);

  if (reservationsResult.error || petsResult.error || unreadResult.error) {
    return NextResponse.json(
      { message: reservationsResult.error?.message ?? petsResult.error?.message ?? unreadResult.error?.message },
      { status: 500 },
    );
  }

  const reservations = new Map((reservationsResult.data ?? []).map((row: any) => [Number(row.id), row]));
  const pets = new Map((petsResult.data ?? []).map((row: any) => [Number(row.id), row]));
  const unreadMap = new Map<number, number>();
  for (const row of unreadResult.data ?? []) {
    const id = Number((row as any).conversation_id);
    unreadMap.set(id, (unreadMap.get(id) ?? 0) + 1);
  }

  return NextResponse.json({
    conversations: rows.map((row: any) => ({
      ...row,
      reservation: reservations.get(Number(row.reservation_id)) ?? null,
      pet: pets.get(Number(row.pet_id)) ?? null,
      unread_count: unreadMap.get(Number(row.id)) ?? 0,
    })),
  });
}
