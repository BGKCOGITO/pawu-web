import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabase-admin";
import { getUserFromRequest, isMasterAdmin } from "../../../../lib/platform-access";

export async function GET(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user || !(await isMasterAdmin(user.id))) {
    return NextResponse.json({ ok: false, message: "관리자 권한이 없습니다." }, { status: 403 });
  }

  const today = new Date().toISOString().slice(0, 10);
  const monthStart = `${today.slice(0, 7)}-01`;
  const [hospitalCount, pendingVerificationCount, userCount, guardianCount, hospitalUserCount, petCount, monthReservationCount, monthCompletedCount, openChatCount, unreadReportCount, recentAuditLogs] = await Promise.all([
    supabaseAdmin.from("hospitals").select("id", { count: "exact", head: true }),
    supabaseAdmin.from("hospital_verification_requests").select("id", { count: "exact", head: true }).in("status", ["pending", "reviewing", "needs_documents"]),
    supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }).eq("status", "active").eq("role", "guardian"),
    supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }).eq("status", "active").eq("role", "hospital"),
    supabaseAdmin.from("pets").select("id", { count: "exact", head: true }),
    supabaseAdmin.from("reservations").select("id", { count: "exact", head: true }).gte("reservation_date", monthStart),
    supabaseAdmin.from("reservations").select("id", { count: "exact", head: true }).gte("reservation_date", monthStart).eq("status", "completed"),
    supabaseAdmin.from("chat_conversations").select("id", { count: "exact", head: true }).eq("status", "open"),
    supabaseAdmin.from("service_reports").select("id", { count: "exact", head: true }).in("status", ["new", "reviewing"]),
    supabaseAdmin.from("audit_logs").select("id, action, entity_type, created_at").order("created_at", { ascending: false }).limit(10),
  ]);

  return NextResponse.json({ ok: true, data: {
    hospitals: hospitalCount.count ?? 0,
    pendingVerifications: pendingVerificationCount.count ?? 0,
    users: userCount.count ?? 0,
    guardianUsers: guardianCount.count ?? 0,
    hospitalUsers: hospitalUserCount.count ?? 0,
    pets: petCount.count ?? 0,
    monthReservations: monthReservationCount.count ?? 0,
    monthCompleted: monthCompletedCount.count ?? 0,
    openChats: openChatCount.count ?? 0,
    openReports: unreadReportCount.count ?? 0,
    recentAuditLogs: recentAuditLogs.data ?? [],
  }});
}
