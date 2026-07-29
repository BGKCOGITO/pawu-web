import { NextResponse } from "next/server";
import { getAuthUser, getHospitalAccess } from "../../../../../../lib/v5-access";
import { supabaseAdmin } from "../../../../../../lib/supabase-admin";

const reservationActions: Record<string, string> = {
  approve: "approved",
  arrive: "arrived",
  start_treatment: "in_progress",
  complete: "completed",
  cancel: "cancelled",
};

export async function POST(request: Request) {
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

  const body = (await request.json()) as {
    reservationId?: number;
    action?: string;
  };

  const reservationId = Number(body.reservationId);
  const targetStatus = body.action ? reservationActions[body.action] : null;

  if (!Number.isInteger(reservationId) || !targetStatus) {
    return NextResponse.json(
      { ok: false, message: "업무 처리 정보가 올바르지 않습니다." },
      { status: 400 },
    );
  }

  if (body.action === "complete") {
    const { data: invoice } = await supabaseAdmin
      .from("hospital_invoices")
      .select("id, status, inventory_finalized_at")
      .eq("reservation_id", reservationId)
      .eq("hospital_id", access.hospitalId)
      .maybeSingle();

    if (invoice && invoice.inventory_finalized_at === null) {
      return NextResponse.json(
        {
          ok: false,
          code: "INVENTORY_REVIEW_REQUIRED",
          invoiceId: invoice.id,
          message: "재고 사용량 검토와 차감 확정이 먼저 필요합니다.",
        },
        { status: 409 },
      );
    }
  }

  const { error } = await supabaseAdmin
    .from("reservations")
    .update({
      status: targetStatus,
      workflow_updated_at: new Date().toISOString(),
    })
    .eq("id", reservationId)
    .eq("hospital_id", access.hospitalId);

  if (error) {
    return NextResponse.json(
      { ok: false, message: error.message },
      { status: 400 },
    );
  }

  return NextResponse.json({ ok: true, status: targetStatus });
}
