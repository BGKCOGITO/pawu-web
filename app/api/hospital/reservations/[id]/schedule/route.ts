import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireHospitalContext } from "@/lib/hospital-api-auth";

function normalizeTime(value: unknown) {
  return String(value ?? "").slice(0, 5);
}
function toMinutes(value: string) {
  const [h, m] = value.split(":").map(Number);
  return h * 60 + m;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = await requireHospitalContext(request, "manage_reservations");
  if ("error" in context) {
    return NextResponse.json({ message: context.error }, { status: context.status });
  }

  const { id } = await params;
  const reservationId = Number(id);
  const body = await request.json().catch(() => null);
  const reservationDate = String(body?.reservationDate ?? "");
  const reservationTime = normalizeTime(body?.reservationTime);
  const reason = String(body?.reason ?? "").trim();

  if (!Number.isInteger(reservationId) || !/^\d{4}-\d{2}-\d{2}$/.test(reservationDate) || !/^\d{2}:\d{2}$/.test(reservationTime)) {
    return NextResponse.json({ message: "변경할 날짜와 시간을 확인해 주세요." }, { status: 400 });
  }

  const { data: existing, error: existingError } = await supabaseAdmin
    .from("reservations")
    .select("id,status,reservation_date,reservation_time,user_id,pet_id,hospital_id")
    .eq("id", reservationId)
    .eq("hospital_id", context.hospitalId)
    .maybeSingle();

  if (existingError) return NextResponse.json({ message: existingError.message }, { status: 500 });
  if (!existing) return NextResponse.json({ message: "예약을 찾을 수 없습니다." }, { status: 404 });
  if (!["requested", "approved"].includes(existing.status)) {
    return NextResponse.json({ message: "현재 상태에서는 예약시간을 변경할 수 없습니다." }, { status: 409 });
  }

  const dayOfWeek = new Date(`${reservationDate}T12:00:00`).getDay();
  const [hoursResult, blocksResult, conflictResult] = await Promise.all([
    supabaseAdmin
      .from("hospital_business_hours")
      .select("is_open,open_time,close_time,break_start_time,break_end_time")
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

  if (hoursResult.error || blocksResult.error || conflictResult.error) {
    return NextResponse.json({ message: hoursResult.error?.message ?? blocksResult.error?.message ?? conflictResult.error?.message ?? "예약 가능 여부 확인 실패" }, { status: 500 });
  }

  const hours = hoursResult.data;
  if (!hours || !hours.is_open || !hours.open_time || !hours.close_time) {
    return NextResponse.json({ message: "선택한 날짜는 운영시간이 없거나 휴무일입니다." }, { status: 409 });
  }

  const target = toMinutes(reservationTime);
  const open = toMinutes(normalizeTime(hours.open_time));
  const close = toMinutes(normalizeTime(hours.close_time));
  if (target < open || target >= close) {
    return NextResponse.json({ message: "병원 운영시간 안의 시간을 선택해 주세요." }, { status: 409 });
  }

  if (hours.break_start_time && hours.break_end_time) {
    const breakStart = toMinutes(normalizeTime(hours.break_start_time));
    const breakEnd = toMinutes(normalizeTime(hours.break_end_time));
    if (target >= breakStart && target < breakEnd) {
      return NextResponse.json({ message: "휴게시간에는 예약할 수 없습니다." }, { status: 409 });
    }
  }

  const blocked = (blocksResult.data ?? []).some((block) => {
    const start = toMinutes(normalizeTime(block.start_time));
    const end = toMinutes(normalizeTime(block.end_time));
    return target >= start && target < end;
  });
  if (blocked) return NextResponse.json({ message: "병원에서 임시 마감한 시간입니다." }, { status: 409 });
  if ((conflictResult.data ?? []).length > 0) return NextResponse.json({ message: "이미 다른 예약이 있는 시간입니다." }, { status: 409 });

  const { error: updateError } = await supabaseAdmin
    .from("reservations")
    .update({ reservation_date: reservationDate, reservation_time: reservationTime })
    .eq("id", reservationId)
    .eq("hospital_id", context.hospitalId);

  if (updateError) return NextResponse.json({ message: updateError.message }, { status: 500 });

  const { data: conversation } = await supabaseAdmin
    .from("chat_conversations")
    .select("id")
    .eq("reservation_id", reservationId)
    .maybeSingle();

  if (conversation) {
    const content = `병원에서 예약시간을 ${reservationDate} ${reservationTime}으로 변경했습니다.${reason ? `\n변경 사유: ${reason}` : ""}`;
    const now = new Date().toISOString();
    await supabaseAdmin.from("chat_messages").insert({
      conversation_id: conversation.id,
      sender_user_id: context.user.id,
      sender_type: "system",
      message_type: "system",
      content,
    });
    await supabaseAdmin
      .from("chat_conversations")
      .update({ last_message_at: now, last_message_preview: content.slice(0, 120) })
      .eq("id", conversation.id);
  }

  return NextResponse.json({ ok: true, reservationDate, reservationTime });
}
