import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireHospitalContext } from "@/lib/hospital-api-auth";
import {
  attachLatestReservation,
  findConversationByIdentity,
} from "@/lib/chat-conversation-identity";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = await requireHospitalContext(
    request,
    "manage_reservations",
  );
  if ("error" in context) {
    return NextResponse.json(
      { message: context.error },
      { status: context.status },
    );
  }

  const { id } = await params;
  const reservationId = Number(id);
  if (!Number.isInteger(reservationId)) {
    return NextResponse.json(
      { message: "예약번호가 올바르지 않습니다." },
      { status: 400 },
    );
  }

  const { data: reservation, error: reservationError } =
    await supabaseAdmin
      .from("reservations")
      .select("id,user_id,hospital_id,pet_id")
      .eq("id", reservationId)
      .eq("hospital_id", context.hospitalId)
      .maybeSingle();

  if (reservationError) {
    return NextResponse.json(
      { message: reservationError.message },
      { status: 500 },
    );
  }
  if (!reservation) {
    return NextResponse.json(
      { message: "예약을 찾을 수 없습니다." },
      { status: 404 },
    );
  }

  const { data: existing, error: existingError } =
    await findConversationByIdentity({
      hospitalId: Number(reservation.hospital_id),
      guardianUserId: String(reservation.user_id),
      petId:
        reservation.pet_id === null
          ? null
          : Number(reservation.pet_id),
    });

  if (existingError) {
    return NextResponse.json(
      { message: existingError.message },
      { status: 500 },
    );
  }

  if (existing) {
    if (Number(existing.reservation_id) !== reservation.id) {
      await attachLatestReservation(
        Number(existing.id),
        reservation.id,
      );
    }

    return NextResponse.json({
      ok: true,
      conversationId: existing.id,
      reused: true,
    });
  }

  const now = new Date().toISOString();
  const { data: created, error: createError } =
    await supabaseAdmin
      .from("chat_conversations")
      .insert({
        reservation_id: reservation.id,
        guardian_user_id: reservation.user_id,
        hospital_id: reservation.hospital_id,
        pet_id: reservation.pet_id,
        status: "open",
        last_message_at: now,
        last_message_preview:
          "병원에서 예약 상담 채팅을 시작했습니다.",
      })
      .select("id")
      .single();

  if (createError || !created) {
    if (createError?.code === "23505") {
      const retry = await findConversationByIdentity({
        hospitalId: Number(reservation.hospital_id),
        guardianUserId: String(reservation.user_id),
        petId:
          reservation.pet_id === null
            ? null
            : Number(reservation.pet_id),
      });

      if (retry.data) {
        return NextResponse.json({
          ok: true,
          conversationId: retry.data.id,
          reused: true,
        });
      }
    }

    return NextResponse.json(
      {
        message:
          createError?.message ??
          "채팅방을 만들지 못했습니다.",
      },
      { status: 500 },
    );
  }

  await supabaseAdmin.from("chat_messages").insert({
    conversation_id: created.id,
    sender_user_id: context.user.id,
    sender_type: "system",
    message_type: "system",
    content:
      "병원에서 예약 확인을 위한 채팅을 시작했습니다.",
  });

  return NextResponse.json({
    ok: true,
    conversationId: created.id,
    reused: false,
  });
}
