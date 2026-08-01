import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireHospitalContext } from "@/lib/hospital-api-auth";
import { enforceRateLimit } from "@/lib/server/security-policy";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const limited = enforceRateLimit(request, {
    scope: "reservation-chat-start",
    limit: 60,
    windowMs: 60_000,
  });
  if (limited) return limited;

  const context = await requireHospitalContext(request, "manage_reservations");
  if ("error" in context) {
    return NextResponse.json({ message: context.error }, { status: context.status });
  }

  const { id } = await params;
  const reservationId = Number(id);
  if (!Number.isInteger(reservationId)) {
    return NextResponse.json({ message: "예약 정보가 올바르지 않습니다." }, { status: 400 });
  }

  const { data: reservation, error: reservationError } = await supabaseAdmin
    .from("reservations")
    .select("id,user_id,hospital_id,pet_id,guardian_name,pet_name,status,reservation_date,reservation_time")
    .eq("id", reservationId)
    .eq("hospital_id", context.hospitalId)
    .maybeSingle();

  if (reservationError || !reservation) {
    return NextResponse.json({ message: "예약을 찾을 수 없습니다." }, { status: 404 });
  }

  const { data: existing } = await supabaseAdmin
    .from("chat_conversations")
    .select("id")
    .eq("reservation_id", reservation.id)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ success: true, conversationId: existing.id });
  }

  const initialText = `${reservation.guardian_name} 보호자님, ${reservation.reservation_date} ${String(reservation.reservation_time).slice(0, 5)} 예약과 관련해 병원에서 채팅을 시작했습니다.`;
  const now = new Date().toISOString();

  const { data: conversation, error: conversationError } = await supabaseAdmin
    .from("chat_conversations")
    .insert({
      reservation_id: reservation.id,
      guardian_user_id: reservation.user_id,
      hospital_id: reservation.hospital_id,
      pet_id: reservation.pet_id,
      status: "open",
      last_message_at: now,
      last_message_preview: initialText.slice(0, 120),
    })
    .select("id")
    .single();

  if (conversationError || !conversation) {
    return NextResponse.json(
      { message: conversationError?.message ?? "채팅방을 만들지 못했습니다." },
      { status: 500 },
    );
  }

  await supabaseAdmin.from("chat_messages").insert({
    conversation_id: conversation.id,
    sender_user_id: context.user.id,
    sender_type: "hospital",
    message_type: "system",
    content: initialText,
  });

  return NextResponse.json({ success: true, conversationId: conversation.id });
}
