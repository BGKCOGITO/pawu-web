import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireHospitalContext } from "@/lib/hospital-api-auth";
import { enforceRateLimit } from "@/lib/server/security-policy";
import { writeAuditLogV2 } from "@/lib/server/audit-v2";

function normalizeTime(value: unknown) {
  return String(value ?? "").slice(0, 5);
}

function timeToMinutes(value: string) {
  const [hour, minute] = normalizeTime(value).split(":").map(Number);
  return hour * 60 + minute;
}

function insideBlock(time: string, start: string, end: string) {
  const target = normalizeTime(time);
  return target >= normalizeTime(start) && target < normalizeTime(end);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const limited = enforceRateLimit(request, {
    scope: "reservation-schedule",
    limit: 90,
    windowMs: 60_000,
  });
  if (limited) return limited;

  const context = await requireHospitalContext(request, "manage_reservations");
  if ("error" in context) {
    return NextResponse.json({ message: context.error }, { status: context.status });
  }

  const { id } = await params;
  const reservationId = Number(id);
  const body = await request.json().catch(() => null);
  const reservationDate = String(body?.reservation_date ?? "").trim();
  const reservationTime = normalizeTime(body?.reservation_time);
  const reason = String(body?.reason ?? "").trim().slice(0, 300);

  if (
    !Number.isInteger(reservationId) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(reservationDate) ||
    !/^\d{2}:\d{2}$/.test(reservationTime)
  ) {
    return NextResponse.json(
      { message: "변경할 예약 날짜와 시간을 확인해 주세요." },
      { status: 400 },
    );
  }

  const { data: existing, error: existingError } = await supabaseAdmin
    .from("reservations")
    .select("id,hospital_id,user_id,pet_id,guardian_name,reservation_date,reservation_time,status")
    .eq("id", reservationId)
    .eq("hospital_id", context.hospitalId)
    .maybeSingle();

  if (existingError || !existing) {
    return NextResponse.json(
      { message: "변경할 예약을 찾을 수 없습니다." },
      { status: 404 },
    );
  }

  if (!["requested", "approved"].includes(existing.status)) {
    return NextResponse.json(
      { message: "현재 상태에서는 예약 시간을 변경할 수 없습니다." },
      { status: 409 },
    );
  }

  const dayOfWeek = new Date(`${reservationDate}T12:00:00`).getDay();

  const [businessHourResult, timeBlocksResult, duplicatedResult] = await Promise.all([
    supabaseAdmin
      .from("hospital_business_hours")
      .select("is_open,open_time,close_time,break_start_time,break_end_time,slot_interval_minutes")
      .eq("hospital_id", context.hospitalId)
      .eq("day_of_week", dayOfWeek)
      .maybeSingle(),
    supabaseAdmin
      .from("hospital_time_blocks")
      .select("start_time,end_time")
      .eq("hospital_id", context.hospitalId)
      .eq("block_date", reservationDate),
    supabaseAdmin
      .from("reservations")
      .select("id")
      .eq("hospital_id", context.hospitalId)
      .eq("reservation_date", reservationDate)
      .eq("reservation_time", reservationTime)
      .in("status", ["requested", "approved"])
      .neq("id", reservationId)
      .limit(1),
  ]);

  if (businessHourResult.error || timeBlocksResult.error || duplicatedResult.error) {
    return NextResponse.json(
      { message: "예약 가능 시간을 확인하지 못했습니다." },
      { status: 500 },
    );
  }

  const businessHour = businessHourResult.data;
  if (!businessHour || !businessHour.is_open || !businessHour.open_time || !businessHour.close_time) {
    return NextResponse.json(
      { message: "선택한 날짜는 운영시간이 없거나 휴무일입니다." },
      { status: 409 },
    );
  }

  const targetMinutes = timeToMinutes(reservationTime);
  const openMinutes = timeToMinutes(businessHour.open_time);
  const closeMinutes = timeToMinutes(businessHour.close_time);
  const interval = Math.max(5, Number(businessHour.slot_interval_minutes) || 30);

  if (
    targetMinutes < openMinutes ||
    targetMinutes >= closeMinutes ||
    (targetMinutes - openMinutes) % interval !== 0
  ) {
    return NextResponse.json(
      { message: "병원 운영시간 또는 예약 간격에 맞지 않는 시간입니다." },
      { status: 409 },
    );
  }

  if (
    businessHour.break_start_time &&
    businessHour.break_end_time &&
    insideBlock(reservationTime, businessHour.break_start_time, businessHour.break_end_time)
  ) {
    return NextResponse.json(
      { message: "휴게시간에는 예약을 변경할 수 없습니다." },
      { status: 409 },
    );
  }

  const blocked = (timeBlocksResult.data ?? []).some((block) =>
    insideBlock(reservationTime, block.start_time, block.end_time),
  );

  if (blocked || (duplicatedResult.data ?? []).length > 0) {
    return NextResponse.json(
      { message: "이미 예약되었거나 임시 마감된 시간입니다." },
      { status: 409 },
    );
  }

  const previous = {
    reservation_date: existing.reservation_date,
    reservation_time: normalizeTime(existing.reservation_time),
    status: existing.status,
  };

  const { error: updateError } = await supabaseAdmin
    .from("reservations")
    .update({
      reservation_date: reservationDate,
      reservation_time: reservationTime,
      status: "approved",
    })
    .eq("id", reservationId)
    .eq("hospital_id", context.hospitalId);

  if (updateError) {
    return NextResponse.json({ message: updateError.message }, { status: 500 });
  }

  const { data: conversation } = await supabaseAdmin
    .from("chat_conversations")
    .select("id")
    .eq("reservation_id", reservationId)
    .maybeSingle();

  if (conversation) {
    const notice = `병원에서 예약 시간을 ${previous.reservation_date} ${previous.reservation_time}에서 ${reservationDate} ${reservationTime}으로 변경했습니다.${reason ? `\n사유: ${reason}` : ""}`;
    const { data: message } = await supabaseAdmin
      .from("chat_messages")
      .insert({
        conversation_id: conversation.id,
        sender_user_id: context.user.id,
        sender_type: "hospital",
        message_type: "system",
        content: notice,
      })
      .select("created_at")
      .single();

    await supabaseAdmin
      .from("chat_conversations")
      .update({
        last_message_at: message?.created_at ?? new Date().toISOString(),
        last_message_preview: notice.slice(0, 120),
      })
      .eq("id", conversation.id);
  }

  await writeAuditLogV2({
    request,
    actorUserId: context.user.id,
    actorType: "hospital",
    hospitalId: context.hospitalId,
    action: "reservation.schedule_changed",
    entityType: "reservation",
    entityId: reservationId,
    before: previous,
    after: {
      reservation_date: reservationDate,
      reservation_time: reservationTime,
      status: "approved",
      reason: reason || null,
    },
  });

  return NextResponse.json({
    success: true,
    reservation_date: reservationDate,
    reservation_time: reservationTime,
    status: "approved",
  });
}
