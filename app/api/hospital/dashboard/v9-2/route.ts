import { NextRequest, NextResponse } from "next/server";
import { requireHospitalContext } from "@/lib/hospital-api-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { enforceRateLimit } from "@/lib/server/security-policy";

const ACTIVE_INPATIENT_STATUSES = [
  "planned",
  "admitted",
  "in_treatment",
  "recovering",
  "ready_for_discharge",
];

function seoulDate(offsetDays = 0) {
  const date = new Date(Date.now() + offsetDays * 86_400_000);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function startOfSeoulDay(date: string) {
  return `${date}T00:00:00+09:00`;
}

function endOfSeoulDay(date: string) {
  return `${date}T23:59:59.999+09:00`;
}

export async function GET(request: NextRequest) {
  const limited = enforceRateLimit(request, {
    scope: "hospital-dashboard-v9-2",
    limit: 180,
    windowMs: 60_000,
  });
  if (limited) return limited;

  const context = await requireHospitalContext(request);
  if ("error" in context) {
    return NextResponse.json(
      { ok: false, message: context.error },
      { status: context.status },
    );
  }

  const today = seoulDate();
  const yesterday = seoulDate(-1);
  const sevenDaysAgo = seoulDate(-6);
  const monthStart = `${today.slice(0, 7)}-01`;

  const [
    reservations,
    requestedReservations,
    activeInpatients,
    dischargeToday,
    emrDrafts,
    labPending,
    paymentPending,
    monthInvoices,
    sevenDayInvoices,
    aiToday,
    aiMonth,
    lowStockRows,
  ] = await Promise.all([
    supabaseAdmin
      .from("reservations")
      .select("id,status,reservation_time,pet_name,guardian_name,visit_reason")
      .eq("hospital_id", context.hospitalId)
      .eq("reservation_date", today)
      .order("reservation_time")
      .limit(30),
    supabaseAdmin
      .from("reservations")
      .select("id", { count: "exact", head: true })
      .eq("hospital_id", context.hospitalId)
      .eq("status", "requested"),
    supabaseAdmin
      .from("hospitalizations")
      .select("id,status,risk_level,expected_discharge_at", { count: "exact" })
      .eq("hospital_id", context.hospitalId)
      .in("status", ACTIVE_INPATIENT_STATUSES),
    supabaseAdmin
      .from("hospitalizations")
      .select("id", { count: "exact", head: true })
      .eq("hospital_id", context.hospitalId)
      .in("status", ACTIVE_INPATIENT_STATUSES)
      .gte("expected_discharge_at", startOfSeoulDay(today))
      .lte("expected_discharge_at", endOfSeoulDay(today)),
    supabaseAdmin
      .from("emr_records")
      .select("id", { count: "exact", head: true })
      .eq("hospital_id", context.hospitalId)
      .eq("status", "draft"),
    supabaseAdmin
      .from("lab_orders")
      .select("id", { count: "exact", head: true })
      .eq("hospital_id", context.hospitalId)
      .in("status", ["ordered", "collected", "processing"]),
    supabaseAdmin
      .from("hospital_invoices")
      .select("id", { count: "exact", head: true })
      .eq("hospital_id", context.hospitalId)
      .eq("status", "payment_pending"),
    supabaseAdmin
      .from("hospital_invoices")
      .select("total_amount,paid_amount,status,created_at")
      .eq("hospital_id", context.hospitalId)
      .gte("created_at", startOfSeoulDay(monthStart))
      .in("status", ["payment_pending", "paid"]),
    supabaseAdmin
      .from("hospital_invoices")
      .select("total_amount,paid_amount,status,created_at")
      .eq("hospital_id", context.hospitalId)
      .gte("created_at", startOfSeoulDay(sevenDaysAgo))
      .in("status", ["payment_pending", "paid"]),
    supabaseAdmin
      .from("ai_medical_usage_logs")
      .select("total_tokens,succeeded", { count: "exact" })
      .eq("hospital_id", context.hospitalId)
      .gte("created_at", startOfSeoulDay(today))
      .lte("created_at", endOfSeoulDay(today)),
    supabaseAdmin
      .from("ai_medical_usage_logs")
      .select("total_tokens,succeeded", { count: "exact" })
      .eq("hospital_id", context.hospitalId)
      .gte("created_at", startOfSeoulDay(monthStart)),
    supabaseAdmin
      .from("inventory_items")
      .select("id,name,unit,current_quantity,minimum_quantity")
      .eq("hospital_id", context.hospitalId)
      .eq("is_active", true),
  ]);

  const todayRows = reservations.data ?? [];
  const inpatientRows = activeInpatients.data ?? [];
  const invoiceRows = monthInvoices.data ?? [];
  const aiTodayRows = aiToday.data ?? [];
  const aiMonthRows = aiMonth.data ?? [];
  const lowStock = (lowStockRows.data ?? []).filter(
    (row) => Number(row.current_quantity) <= Number(row.minimum_quantity),
  );

  const revenueByDate = new Map<string, number>();
  for (let index = 0; index < 7; index += 1) {
    revenueByDate.set(seoulDate(index - 6), 0);
  }
  for (const invoice of sevenDayInvoices.data ?? []) {
    const key = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(invoice.created_at));
    revenueByDate.set(
      key,
      (revenueByDate.get(key) ?? 0) + Number(invoice.paid_amount ?? invoice.total_amount ?? 0),
    );
  }

  const warnings = [
    reservations.error,
    requestedReservations.error,
    activeInpatients.error,
    dischargeToday.error,
    emrDrafts.error,
    labPending.error,
    paymentPending.error,
    monthInvoices.error,
    sevenDayInvoices.error,
    aiToday.error,
    aiMonth.error,
    lowStockRows.error,
  ]
    .filter(Boolean)
    .map((error) => error?.message ?? "일부 통계를 불러오지 못했습니다.");

  return NextResponse.json({
    ok: true,
    data: {
      today,
      yesterday,
      metrics: {
        todayReservations: todayRows.length,
        todayCompleted: todayRows.filter((row) => row.status === "completed").length,
        requestedReservations: requestedReservations.count ?? 0,
        activeInpatients: activeInpatients.count ?? inpatientRows.length,
        criticalInpatients: inpatientRows.filter((row) => row.risk_level === "critical").length,
        dischargeToday: dischargeToday.count ?? 0,
        emrDrafts: emrDrafts.count ?? 0,
        labPending: labPending.count ?? 0,
        paymentPending: paymentPending.count ?? 0,
        lowStockCount: lowStock.length,
        monthRevenue: invoiceRows.reduce(
          (sum, row) => sum + Number(row.paid_amount ?? row.total_amount ?? 0),
          0,
        ),
        aiTodayCalls: aiToday.count ?? aiTodayRows.length,
        aiTodayTokens: aiTodayRows.reduce((sum, row) => sum + Number(row.total_tokens ?? 0), 0),
        aiMonthCalls: aiMonth.count ?? aiMonthRows.length,
        aiMonthTokens: aiMonthRows.reduce((sum, row) => sum + Number(row.total_tokens ?? 0), 0),
      },
      todayRows,
      revenueTrend: [...revenueByDate.entries()].map(([date, amount]) => ({ date, amount })),
      lowStock: lowStock.slice(0, 8),
      warnings,
    },
  });
}
