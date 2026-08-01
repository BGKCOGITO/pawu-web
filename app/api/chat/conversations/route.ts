import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabase-admin";
import { getAuthUser, readBearer } from "../../../../lib/chat-access";


export async function GET(request: Request) {
  const user = await getAuthUser(readBearer(request));
  if (!user) {
    return NextResponse.json({ ok: false, message: "로그인이 필요합니다." }, { status: 401 });
  }

  const { data, error } = await supabaseAdmin
    .from("chat_conversations")
    .select("id,reservation_id,status,last_message_at,last_message_preview,hospitals(name),pets(name)")
    .eq("guardian_user_id", user.id)
    .order("last_message_at", { ascending: false });

  if (error) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, conversations: data ?? [] });
}

export async function POST(request: Request) {
  const user = await getAuthUser(readBearer(request));
  if (!user) {
    return NextResponse.json({ ok: false, message: "로그인이 필요합니다." }, { status: 401 });
  }

  const body = (await request.json()) as {
    reservationId?: number;
  };

  const reservationId = Number(body.reservationId);
  if (!Number.isInteger(reservationId)) {
    return NextResponse.json({ ok: false, message: "예약 정보가 올바르지 않습니다." }, { status: 400 });
  }

  const { data: reservation } = await supabaseAdmin
    .from("reservations")
    .select("id, user_id, hospital_id, pet_id, status")
    .eq("id", reservationId)
    .maybeSingle();

  if (!reservation || reservation.user_id !== user.id) {
    return NextResponse.json({ ok: false, message: "예약을 찾지 못했습니다." }, { status: 404 });
  }

  if (!["approved", "arrived", "in_progress", "payment_pending", "completed"].includes(reservation.status)) {
    return NextResponse.json(
      { ok: false, message: "병원에서 승인된 예약부터 채팅을 시작할 수 있습니다." },
      { status: 409 },
    );
  }

  const { data: existing } = await supabaseAdmin
    .from("chat_conversations")
    .select("id")
    .eq("reservation_id", reservation.id)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ ok: true, conversationId: existing.id });
  }

  const { data: created, error } = await supabaseAdmin
    .from("chat_conversations")
    .insert({
      reservation_id: reservation.id,
      guardian_user_id: reservation.user_id,
      hospital_id: reservation.hospital_id,
      pet_id: reservation.pet_id,
      status: "open",
      last_message_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error || !created) {
    return NextResponse.json(
      { ok: false, message: error?.message ?? "채팅방을 만들지 못했습니다." },
      { status: 400 },
    );
  }

  return NextResponse.json({ ok: true, conversationId: created.id });
}
