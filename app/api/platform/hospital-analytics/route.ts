import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabase-admin";
import { getHospitalMembership, getUserFromRequest } from "../../../../lib/platform-access";

export async function GET(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ ok: false, message: "로그인이 필요합니다." }, { status: 401 });
  }

  const membership = await getHospitalMembership(user.id);
  if (!membership) {
    return NextResponse.json({ ok: false, message: "병원 계정이 아닙니다." }, { status: 403 });
  }

  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
  const nextMonthStart = new Date(today.getFullYear(), today.getMonth() + 1, 1).toISOString().slice(0, 10);
  const previousMonthStart = new Date(today.getFullYear(), today.getMonth() - 5, 1);

  const { data: reservations, error } = await supabaseAdmin
    .from("reservations")
    .select("id, user_id, pet_id, reservation_date, status, created_at")
    .eq("hospital_id", membership.hospitalId)
    .gte("reservation_date", previousMonthStart.toISOString().slice(0, 10))
    .lt("reservation_date", nextMonthStart);

  if (error) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 400 });
  }

  const rows = reservations ?? [];
  const monthRows = rows.filter((row) => row.reservation_date >= monthStart);
  const completed = monthRows.filter((row) => row.status === "completed");
  const cancelled = monthRows.filter((row) => ["cancelled", "rejected", "no_show"].includes(row.status));
  const active = monthRows.filter((row) => !["cancelled", "rejected"].includes(row.status));

  const guardianCounts = new Map<string, number>();
  completed.forEach((row) => {
    if (row.user_id) guardianCounts.set(row.user_id, (guardianCounts.get(row.user_id) ?? 0) + 1);
  });

  const repeatGuardians = [...guardianCounts.values()].filter((count) => count >= 2).length;
  const monthly = new Map<string, { total: number; completed: number; cancelled: number }>();

  for (let offset = 5; offset >= 0; offset -= 1) {
    const date = new Date(today.getFullYear(), today.getMonth() - offset, 1);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    monthly.set(key, { total: 0, completed: 0, cancelled: 0 });
  }

  rows.forEach((row) => {
    const key = row.reservation_date.slice(0, 7);
    const bucket = monthly.get(key);
    if (!bucket) return;
    bucket.total += 1;
    if (row.status === "completed") bucket.completed += 1;
    if (["cancelled", "rejected", "no_show"].includes(row.status)) bucket.cancelled += 1;
  });

  const { count: patientCount } = await supabaseAdmin
    .from("reservations")
    .select("pet_id", { count: "exact", head: true })
    .eq("hospital_id", membership.hospitalId)
    .not("pet_id", "is", null);

  const { count: unreadChatCount } = await supabaseAdmin
    .from("chat_conversations")
    .select("id", { count: "exact", head: true })
    .eq("hospital_id", membership.hospitalId)
    .eq("status", "open");

  return NextResponse.json({
    ok: true,
    data: {
      thisMonth: {
        totalReservations: monthRows.length,
        activeReservations: active.length,
        completedReservations: completed.length,
        cancellationRate: monthRows.length ? Math.round((cancelled.length / monthRows.length) * 1000) / 10 : 0,
        repeatGuardianRate: guardianCounts.size ? Math.round((repeatGuardians / guardianCounts.size) * 1000) / 10 : 0,
        uniquePatientsEstimate: patientCount ?? 0,
        openChats: unreadChatCount ?? 0,
      },
      monthly: [...monthly.entries()].map(([month, values]) => ({ month, ...values })),
    },
  });
}
