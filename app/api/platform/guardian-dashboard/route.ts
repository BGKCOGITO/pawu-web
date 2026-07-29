import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabase-admin";
import { getUserFromRequest } from "../../../../lib/platform-access";

export async function GET(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ ok: false, message: "로그인이 필요합니다." }, { status: 401 });
  }

  const today = new Date().toISOString().slice(0, 10);
  const nextMonth = new Date();
  nextMonth.setDate(nextMonth.getDate() + 30);
  const until = nextMonth.toISOString().slice(0, 10);

  const [
    petsResult,
    reservationsResult,
    recordsResult,
    medicationsResult,
    vaccinationsResult,
    unreadNotificationsResult,
    unreadChatsResult,
  ] = await Promise.all([
    supabaseAdmin
      .from("pets")
      .select("id, name, species, breed, weight_kg")
      .eq("user_id", user.id)
      .order("created_at"),
    supabaseAdmin
      .from("reservations")
      .select("id, reservation_date, reservation_time, status, hospital_id, pet_id, hospitals(name), pets(name)")
      .eq("user_id", user.id)
      .gte("reservation_date", today)
      .in("status", ["requested", "approved", "arrived", "in_progress", "payment_pending"])
      .order("reservation_date")
      .order("reservation_time")
      .limit(5),
    supabaseAdmin
      .from("medical_records")
      .select("id, diagnosis, created_at, pet_id, hospitals(name), pets(name)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(5),
    supabaseAdmin
      .from("medication_schedules")
      .select("id, medication_name, dosage, start_date, end_date, times, pet_id, pets(name)")
      .eq("user_id", user.id)
      .lte("start_date", until)
      .or(`end_date.is.null,end_date.gte.${today}`)
      .order("start_date")
      .limit(10),
    supabaseAdmin
      .from("vaccination_records")
      .select("id, vaccine_name, next_due_date, pet_id, pets(name)")
      .eq("user_id", user.id)
      .gte("next_due_date", today)
      .lte("next_due_date", until)
      .order("next_due_date")
      .limit(10),
    supabaseAdmin
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .is("read_at", null),
    supabaseAdmin
      .from("chat_conversations")
      .select("id")
      .eq("guardian_user_id", user.id)
      .order("last_message_at", { ascending: false })
      .limit(10),
  ]);

  const conversationIds = (unreadChatsResult.data ?? []).map((item) => item.id);
  let unreadChatCount = 0;

  if (conversationIds.length) {
    const { count } = await supabaseAdmin
      .from("chat_messages")
      .select("id", { count: "exact", head: true })
      .in("conversation_id", conversationIds)
      .neq("sender_user_id", user.id)
      .is("read_at", null);

    unreadChatCount = count ?? 0;
  }

  return NextResponse.json({
    ok: true,
    data: {
      pets: petsResult.data ?? [],
      reservations: reservationsResult.data ?? [],
      recentRecords: recordsResult.data ?? [],
      medications: medicationsResult.data ?? [],
      vaccinations: vaccinationsResult.data ?? [],
      unreadNotifications: unreadNotificationsResult.count ?? 0,
      unreadChats: unreadChatCount,
    },
  });
}
