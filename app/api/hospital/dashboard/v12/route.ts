import { NextRequest, NextResponse } from "next/server";
import { requireHospitalContext } from "@/lib/hospital-api-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { enforceRateLimit } from "@/lib/server/security-policy";

const ACTIVE_INPATIENT_STATUSES = ["planned", "admitted", "in_treatment", "recovering", "ready_for_discharge"];
const CANCELLED_STATUSES = ["cancelled", "rejected", "no_show"];

function seoulDate(offsetDays = 0) {
  const date = new Date(Date.now() + offsetDays * 86_400_000);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function monthKey(offsetMonths = 0) {
  const now = new Date();
  const date = new Date(now.getFullYear(), now.getMonth() + offsetMonths, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function safeNumber(value: unknown) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function normalizeReason(value: string | null | undefined) {
  const text = String(value ?? "").trim();
  if (!text) return "기타 진료";
  return text.length > 18 ? `${text.slice(0, 18)}…` : text;
}

export async function GET(request: NextRequest) {
  const limited = enforceRateLimit(request, {
    scope: "hospital-dashboard-v12",
    limit: 120,
    windowMs: 60_000,
  });
  if (limited) return limited;

  const context = await requireHospitalContext(request);
  if ("error" in context) {
    return NextResponse.json({ ok: false, message: context.error }, { status: context.status });
  }

  const hospitalId = context.hospitalId;
  const today = seoulDate();
  const monthStart = `${monthKey()}-01`;
  const nextMonthStart = `${monthKey(1)}-01`;
  const sixMonthsStart = `${monthKey(-5)}-01`;

  const results = await Promise.all([
    supabaseAdmin.from("reservations").select("id,status,reservation_time,pet_name,guardian_name,visit_reason,user_id,pet_id,reservation_date,created_at").eq("hospital_id", hospitalId).gte("reservation_date", sixMonthsStart).lt("reservation_date", nextMonthStart).order("reservation_date", { ascending: true }).order("reservation_time", { ascending: true }),
    supabaseAdmin.from("hospitalizations").select("id,status,pet_name,guardian_name,admitted_at,expected_discharge_at,discharged_at,risk_level").eq("hospital_id", hospitalId).order("created_at", { ascending: false }).limit(200),
    supabaseAdmin.from("hospital_visit_reviews").select("id,content,hospital_reply,created_at,visit_date,pets(name)").eq("hospital_id", hospitalId).eq("status", "published").order("created_at", { ascending: false }).limit(6),
    supabaseAdmin.from("medication_order_items").select("id,medication_name,medication_orders!inner(hospital_id,created_at)").eq("medication_orders.hospital_id", hospitalId).gte("medication_orders.created_at", `${monthStart}T00:00:00+09:00`).lt("medication_orders.created_at", `${nextMonthStart}T00:00:00+09:00`).limit(1000),
    supabaseAdmin.from("hospital_invoices").select("paid_amount,total_amount,status,created_at").eq("hospital_id", hospitalId).gte("created_at", `${sixMonthsStart}T00:00:00+09:00`).lt("created_at", `${nextMonthStart}T00:00:00+09:00`).limit(5000),
  ]);

  const [reservationResult, inpatientResult, reviewResult, prescriptionResult, invoiceResult] = results;
  if (reservationResult.error) {
    return NextResponse.json({ ok: false, message: reservationResult.error.message }, { status: 400 });
  }

  const reservations = reservationResult.data ?? [];
  const todayRows = reservations.filter((row) => row.reservation_date === today);
  const monthRows = reservations.filter((row) => row.reservation_date >= monthStart && row.reservation_date < nextMonthStart);
  const completedRows = monthRows.filter((row) => row.status === "completed");
  const cancelledRows = monthRows.filter((row) => CANCELLED_STATUSES.includes(row.status));
  const activeInpatients = (inpatientResult.data ?? []).filter((row) => ACTIVE_INPATIENT_STATUSES.includes(String(row.status)));
  const dischargeToday = activeInpatients.filter((row) => String(row.expected_discharge_at ?? "").slice(0, 10) === today);

  const guardianVisits = new Map<string, number>();
  completedRows.forEach((row) => {
    if (row.user_id) guardianVisits.set(row.user_id, (guardianVisits.get(row.user_id) ?? 0) + 1);
  });
  const repeatGuardians = [...guardianVisits.values()].filter((count) => count >= 2).length;
  const repeatRate = guardianVisits.size ? Math.round((repeatGuardians / guardianVisits.size) * 1000) / 10 : 0;

  const reasonCounts = new Map<string, number>();
  completedRows.forEach((row) => {
    const key = normalizeReason(row.visit_reason);
    reasonCounts.set(key, (reasonCounts.get(key) ?? 0) + 1);
  });
  const topReasons = [...reasonCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([label, count]) => ({ label, count }));

  const medicationCounts = new Map<string, number>();
  for (const row of prescriptionResult.data ?? []) {
    const name = String(row.medication_name ?? "").trim() || "미입력 약품";
    medicationCounts.set(name, (medicationCounts.get(name) ?? 0) + 1);
  }
  const topMedications = [...medicationCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([label, count]) => ({ label, count }));

  const monthlyMap = new Map<string, { total: number; completed: number; cancelled: number; revenue: number }>();
  for (let offset = -5; offset <= 0; offset += 1) {
    monthlyMap.set(monthKey(offset), { total: 0, completed: 0, cancelled: 0, revenue: 0 });
  }
  reservations.forEach((row) => {
    const bucket = monthlyMap.get(String(row.reservation_date).slice(0, 7));
    if (!bucket) return;
    bucket.total += 1;
    if (row.status === "completed") bucket.completed += 1;
    if (CANCELLED_STATUSES.includes(row.status)) bucket.cancelled += 1;
  });
  for (const row of invoiceResult.data ?? []) {
    const bucket = monthlyMap.get(String(row.created_at ?? "").slice(0, 7));
    if (!bucket) continue;
    bucket.revenue += safeNumber(row.paid_amount ?? row.total_amount);
  }

  const currentMonthRevenue = monthlyMap.get(monthKey())?.revenue ?? 0;
  const pendingReviews = (reviewResult.data ?? []).filter((row) => !row.hospital_reply).length;
  const requested = todayRows.filter((row) => row.status === "requested").length;
  const todayCompleted = todayRows.filter((row) => row.status === "completed").length;

  const insights: string[] = [];
  if (todayRows.length > 0) insights.push(`오늘 예약은 ${todayRows.length}건이며, 현재 ${todayCompleted}건이 완료되었습니다.`);
  if (requested > 0) insights.push(`승인 대기 예약 ${requested}건을 확인해 주세요.`);
  if (topReasons[0]) insights.push(`이번 달 가장 많이 기록된 방문 사유는 '${topReasons[0].label}'입니다.`);
  if (repeatRate > 0) insights.push(`이번 달 재방문 보호자 비율은 약 ${repeatRate}%입니다.`);
  if (pendingReviews > 0) insights.push(`답글을 기다리는 방문 후기 ${pendingReviews}건이 있습니다.`);
  if (insights.length === 0) insights.push("아직 요약할 운영 데이터가 충분하지 않습니다.");

  const warnings = [inpatientResult.error, reviewResult.error, prescriptionResult.error, invoiceResult.error]
    .filter(Boolean)
    .map((error) => error?.message ?? "일부 통계를 불러오지 못했습니다.");

  return NextResponse.json({
    ok: true,
    data: {
      today,
      metrics: {
        todayReservations: todayRows.length,
        todayCompleted,
        requestedReservations: requested,
        activeInpatients: activeInpatients.length,
        dischargeToday: dischargeToday.length,
        monthReservations: monthRows.length,
        monthCompleted: completedRows.length,
        monthCancelled: cancelledRows.length,
        cancellationRate: monthRows.length ? Math.round((cancelledRows.length / monthRows.length) * 1000) / 10 : 0,
        uniqueGuardians: guardianVisits.size,
        repeatRate,
        monthRevenue: currentMonthRevenue,
        pendingReviews,
      },
      todayRows: todayRows.slice(0, 40),
      monthly: [...monthlyMap.entries()].map(([month, values]) => ({ month, ...values })),
      topReasons,
      topMedications,
      activeInpatients: activeInpatients.slice(0, 8),
      recentReviews: reviewResult.data ?? [],
      insights,
      warnings,
    },
  });
}
