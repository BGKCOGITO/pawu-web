import { NextResponse } from "next/server";
import { requirePlatformAccess } from "../../../../../lib/v7-platform-access";

const today = () => new Date().toISOString().slice(0, 10);
const monthStart = () => `${today().slice(0, 7)}-01`;

export async function GET(request: Request) {
  const auth = await requirePlatformAccess(request, "view_dashboard");
  if (!auth.ok) return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  const h = auth.access.hospitalId;
  const db = auth.supabaseAdmin;
  const [reservations, waiting, billing, inpatient, surgery, inventory, audit] = await Promise.all([
    db.from("reservations").select("id,status", { count: "exact" }).eq("hospital_id", h).eq("reservation_date", today()),
    db.from("hospital_waiting_entries").select("id,status", { count: "exact" }).eq("hospital_id", h).eq("waiting_date", today()),
    db.from("hospital_invoices").select("paid_amount,outstanding_amount,updated_at,status").eq("hospital_id", h).gte("updated_at", `${monthStart()}T00:00:00`),
    db.from("hospital_admissions").select("id,status", { count: "exact" }).eq("hospital_id", h).eq("status", "admitted"),
    db.from("hospital_surgeries").select("id,status", { count: "exact" }).eq("hospital_id", h).gte("scheduled_start", `${today()}T00:00:00`).lt("scheduled_start", `${today()}T23:59:59`),
    db.from("inventory_alerts").select("id,severity", { count: "exact" }).eq("hospital_id", h).is("resolved_at", null),
    db.from("hospital_audit_logs_v7").select("id,action,resource_type,resource_id,actor_user_id,actor_role,severity,summary,metadata,created_at").eq("hospital_id", h).order("created_at", { ascending: false }).limit(12),
  ]);
  const errors = [reservations.error, waiting.error, billing.error, inpatient.error, surgery.error, inventory.error, audit.error].filter(Boolean);
  if (errors.length) return NextResponse.json({ ok: false, message: errors[0]?.message }, { status: 400 });
  const payments = billing.data ?? [];
  const todayPayments = payments.filter((x: any) => String(x.updated_at ?? "").startsWith(today()));
  const alerts = inventory.data ?? [];
  return NextResponse.json({ ok: true, data: {
    counts: {
      todayReservations: reservations.count ?? 0,
      waitingPatients: (waiting.data ?? []).filter((x: any) => !["completed","cancelled"].includes(String(x.status))).length,
      activeInpatients: inpatient.count ?? 0,
      todaySurgeries: surgery.count ?? 0,
      openInventoryAlerts: inventory.count ?? 0,
    },
    finance: {
      todayPaid: todayPayments.reduce((s: number,x: any)=>s+Number(x.paid_amount ?? 0),0),
      todayOutstanding: todayPayments.reduce((s: number,x: any)=>s+Number(x.outstanding_amount ?? 0),0),
      monthPaid: payments.reduce((s: number,x: any)=>s+Number(x.paid_amount ?? 0),0),
    },
    alerts: {
      critical: alerts.filter((x: any)=>x.severity === "critical").length,
      warning: alerts.filter((x: any)=>x.severity === "warning").length,
      unreadAudit: (audit.data ?? []).filter((x: any)=>x.severity !== "info").length,
    },
    recentAudit: audit.data ?? [],
  }});
}
