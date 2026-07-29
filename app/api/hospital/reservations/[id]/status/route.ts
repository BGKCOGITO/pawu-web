import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireHospitalContext } from "@/lib/hospital-api-auth";
import { enforceRateLimit } from "@/lib/server/security-policy";
import { writeAuditLogV2 } from "@/lib/server/audit-v2";

const allowedStatuses = new Set([
  "approved",
  "rejected",
  "completed",
  "cancelled",
]);

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const limited = enforceRateLimit(request, { scope: "reservation-status", limit: 120, windowMs: 60_000 });
  if (limited) return limited;

  const context = await requireHospitalContext(request, "manage_reservations");

  if ("error" in context) {
    return NextResponse.json(
      { message: context.error },
      { status: context.status },
    );
  }

  const { id } = await params;
  const reservationId = Number(id);
  const body = await request.json().catch(() => null);
  const status = String(body?.status ?? "");

  if (!Number.isInteger(reservationId) || !allowedStatuses.has(status)) {
    return NextResponse.json(
      { message: "예약 상태 변경 요청이 올바르지 않습니다." },
      { status: 400 },
    );
  }

  const { data: existing } = await supabaseAdmin
    .from("reservations")
    .select("id,status,pet_id,user_id")
    .eq("id", reservationId)
    .eq("hospital_id", context.hospitalId)
    .maybeSingle();

  if (!existing) {
    return NextResponse.json(
      { message: "변경할 예약을 찾을 수 없습니다." },
      { status: 404 },
    );
  }

  const { error } = await supabaseAdmin
    .from("reservations")
    .update({ status })
    .eq("id", reservationId)
    .eq("hospital_id", context.hospitalId);

  if (error) {
    return NextResponse.json(
      { message: error.message },
      { status: 500 },
    );
  }

  if (status === "approved" && existing.pet_id) {
    await supabaseAdmin
      .from("hospital_patients")
      .upsert(
        {
          hospital_id: context.hospitalId,
          pet_id: existing.pet_id,
          guardian_user_id: existing.user_id,
          first_reservation_id: existing.id,
          patient_number: `${context.hospitalId}-${existing.pet_id}`,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "hospital_id,pet_id" },
      );
  }

  await writeAuditLogV2({
    request,
    actorUserId: context.user.id,
    actorType: "hospital",
    hospitalId: context.hospitalId,
    action: "reservation.status_changed",
    entityType: "reservation",
    entityId: reservationId,
    before: { status: existing.status },
    after: { status },
  });

  return NextResponse.json({ success: true, status });
}
