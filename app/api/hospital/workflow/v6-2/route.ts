import { NextResponse } from "next/server";
import { getAuthUser, getHospitalAccess } from "../../../../../lib/v5-access";
import { supabaseAdmin } from "../../../../../lib/supabase-admin";

type WorkflowStatus =
  | "reservation_requested"
  | "scheduled"
  | "arrived"
  | "in_progress"
  | "billing"
  | "payment_pending"
  | "paid"
  | "inventory_review"
  | "completed"
  | "cancelled";

function mapReservationStatus(status: string): WorkflowStatus {
  switch (status) {
    case "requested":
      return "reservation_requested";
    case "approved":
      return "scheduled";
    case "arrived":
      return "arrived";
    case "in_progress":
      return "in_progress";
    case "payment_pending":
      return "payment_pending";
    case "completed":
      return "completed";
    case "cancelled":
    case "rejected":
      return "cancelled";
    default:
      return "scheduled";
  }
}

export async function GET(request: Request) {
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json(
      { ok: false, message: "로그인이 필요합니다." },
      { status: 401 },
    );
  }

  const access = await getHospitalAccess(user.id);
  if (!access) {
    return NextResponse.json(
      { ok: false, message: "병원 계정이 아닙니다." },
      { status: 403 },
    );
  }

  const url = new URL(request.url);
  const date = url.searchParams.get("date") ?? new Date().toISOString().slice(0, 10);

  const [{ data: reservations, error: reservationError }, { data: invoices, error: invoiceError }] =
    await Promise.all([
      supabaseAdmin
        .from("reservations")
        .select(`
          id, user_id, pet_id, pet_name, guardian_name, phone,
          reservation_date, reservation_time, visit_reason, symptoms,
          status, created_at,
          pets(name, species, breed)
        `)
        .eq("hospital_id", access.hospitalId)
        .eq("reservation_date", date)
        .order("reservation_time"),
      supabaseAdmin
        .from("hospital_invoices")
        .select(`
          id, reservation_id, pet_id, guardian_user_id, status,
          total_amount, inventory_finalized_at, inventory_reversed_at,
          created_at, payment_requested_at, paid_at,
          pets(name)
        `)
        .eq("hospital_id", access.hospitalId)
        .gte("created_at", `${date}T00:00:00`)
        .lt("created_at", `${date}T23:59:59.999`)
        .order("created_at"),
    ]);

  if (reservationError || invoiceError) {
    return NextResponse.json(
      {
        ok: false,
        message: reservationError?.message ?? invoiceError?.message ?? "업무 목록을 불러오지 못했습니다.",
      },
      { status: 400 },
    );
  }

  const invoiceByReservation = new Map<number, any>();
  for (const invoice of invoices ?? []) {
    if (invoice.reservation_id) {
      invoiceByReservation.set(Number(invoice.reservation_id), invoice);
    }
  }

  const rows = (reservations ?? []).map((reservation) => {
    const invoice = invoiceByReservation.get(Number(reservation.id)) ?? null;
    let workflowStatus = mapReservationStatus(String(reservation.status));

    if (invoice) {
      if (
        invoice.inventory_finalized_at === null &&
        ["payment_pending", "paid"].includes(String(invoice.status))
      ) {
        workflowStatus = "inventory_review";
      } else if (invoice.status === "draft") {
        workflowStatus = "billing";
      } else if (invoice.status === "payment_pending") {
        workflowStatus = "payment_pending";
      } else if (invoice.status === "paid") {
        workflowStatus = "paid";
      }
    }

    const pet = Array.isArray(reservation.pets)
      ? reservation.pets[0]
      : reservation.pets;

    return {
      reservationId: reservation.id,
      invoiceId: invoice?.id ?? null,
      petId: reservation.pet_id,
      petName: pet?.name ?? reservation.pet_name ?? "환자",
      species: pet?.species ?? null,
      breed: pet?.breed ?? null,
      guardianName: reservation.guardian_name ?? "보호자",
      phone: reservation.phone ?? null,
      reservationDate: reservation.reservation_date,
      reservationTime: reservation.reservation_time,
      visitReason: reservation.visit_reason ?? null,
      symptoms: reservation.symptoms ?? null,
      reservationStatus: reservation.status,
      invoiceStatus: invoice?.status ?? null,
      totalAmount: invoice?.total_amount ?? null,
      inventoryFinalizedAt: invoice?.inventory_finalized_at ?? null,
      workflowStatus,
    };
  });

  const counters = {
    total: rows.length,
    requested: rows.filter((row) => row.workflowStatus === "reservation_requested").length,
    scheduled: rows.filter((row) => row.workflowStatus === "scheduled").length,
    arrived: rows.filter((row) => row.workflowStatus === "arrived").length,
    inProgress: rows.filter((row) => row.workflowStatus === "in_progress").length,
    billing: rows.filter((row) => row.workflowStatus === "billing").length,
    paymentPending: rows.filter((row) => row.workflowStatus === "payment_pending").length,
    inventoryReview: rows.filter((row) => row.workflowStatus === "inventory_review").length,
    completed: rows.filter((row) => row.workflowStatus === "completed").length,
  };

  return NextResponse.json({
    ok: true,
    date,
    counters,
    rows,
  });
}
