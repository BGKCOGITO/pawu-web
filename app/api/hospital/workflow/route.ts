import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabase-admin";
import { can, getHospitalAccess, readBearer } from "../../../../lib/hospital-access";

const allowed = ["approved", "arrived", "in_progress", "payment_pending", "completed", "cancelled", "no_show"];

export async function PATCH(request: Request) {
  const access = await getHospitalAccess(readBearer(request));
  if (!access || !can(access, "manage_reservations")) {
    return NextResponse.json({ ok: false, message: "예약 상태 변경 권한이 없습니다." }, { status: 403 });
  }

  const body = await request.json() as { reservationId?: number; status?: string };
  const reservationId = Number(body.reservationId);
  const status = String(body.status ?? "");

  if (!Number.isInteger(reservationId) || !allowed.includes(status)) {
    return NextResponse.json({ ok: false, message: "요청 값이 올바르지 않습니다." }, { status: 400 });
  }

  const { data: reservation } = await supabaseAdmin
    .from("reservations")
    .select("id, hospital_id")
    .eq("id", reservationId)
    .maybeSingle();

  if (!reservation || Number(reservation.hospital_id) !== access.hospitalId) {
    return NextResponse.json({ ok: false, message: "예약을 찾지 못했습니다." }, { status: 404 });
  }

  const { error } = await supabaseAdmin
    .from("reservations")
    .update({ status, workflow_updated_at: new Date().toISOString() })
    .eq("id", reservationId);

  if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
