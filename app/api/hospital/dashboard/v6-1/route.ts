import { NextResponse } from "next/server";
import { getAuthUser, getHospitalAccess } from "../../../../../lib/v5-access";
import { supabaseAdmin } from "../../../../../lib/supabase-admin";

export async function GET(request: Request) {
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ ok: false, message: "로그인이 필요합니다." }, { status: 401 });
  }

  const access = await getHospitalAccess(user.id);
  if (!access) {
    return NextResponse.json({ ok: false, message: "병원 계정이 아닙니다." }, { status: 403 });
  }

  const today = new Date().toISOString().slice(0, 10);
  const monthStart = `${today.slice(0, 7)}-01`;
  const expiryLimit = new Date();
  expiryLimit.setDate(expiryLimit.getDate() + 60);

  const [
    todayReservations,
    requestedReservations,
    paymentPending,
    monthInvoices,
    inventoryItems,
    expiringLots,
  ] = await Promise.all([
    supabaseAdmin
      .from("reservations")
      .select("id, status", { count: "exact" })
      .eq("hospital_id", access.hospitalId)
      .eq("reservation_date", today),
    supabaseAdmin
      .from("reservations")
      .select("id", { count: "exact", head: true })
      .eq("hospital_id", access.hospitalId)
      .eq("status", "requested"),
    supabaseAdmin
      .from("hospital_invoices")
      .select("id", { count: "exact", head: true })
      .eq("hospital_id", access.hospitalId)
      .eq("status", "payment_pending"),
    supabaseAdmin
      .from("hospital_invoices")
      .select("total_amount, status")
      .eq("hospital_id", access.hospitalId)
      .gte("created_at", `${monthStart}T00:00:00`)
      .in("status", ["payment_pending", "paid"]),
    supabaseAdmin
      .from("inventory_items")
      .select("id, name, unit, current_quantity, minimum_quantity")
      .eq("hospital_id", access.hospitalId)
      .eq("is_active", true),
    supabaseAdmin
      .from("inventory_lots")
      .select(`
        id, lot_number, expires_on, remaining_quantity,
        inventory_items!inner(name, hospital_id)
      `)
      .eq("inventory_items.hospital_id", access.hospitalId)
      .gt("remaining_quantity", 0)
      .gte("expires_on", today)
      .lte("expires_on", expiryLimit.toISOString().slice(0, 10))
      .order("expires_on")
      .limit(10),
  ]);

  const reservationRows = todayReservations.data ?? [];
  const inventoryRows = inventoryItems.data ?? [];
  const lowStock = inventoryRows.filter(
    (item) => Number(item.current_quantity) <= Number(item.minimum_quantity),
  );

  const monthRevenue = (monthInvoices.data ?? []).reduce(
    (sum, invoice) => sum + Number(invoice.total_amount ?? 0),
    0,
  );

  return NextResponse.json({
    ok: true,
    data: {
      todayReservations: todayReservations.count ?? reservationRows.length,
      todayCompleted: reservationRows.filter((row) => row.status === "completed").length,
      requestedReservations: requestedReservations.count ?? 0,
      paymentPending: paymentPending.count ?? 0,
      monthRevenue,
      lowStockCount: lowStock.length,
      lowStock: lowStock.slice(0, 10),
      expiringLots: expiringLots.data ?? [],
    },
  });
}
