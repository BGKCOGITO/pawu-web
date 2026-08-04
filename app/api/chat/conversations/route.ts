import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabase-admin";
import { getAuthUser, readBearer } from "../../../../lib/chat-access";
import {
  attachLatestReservation,
  findConversationByIdentity,
} from "@/lib/chat-conversation-identity";

type ConversationRow = {
  id: number;
  reservation_id: number | null;
  guardian_user_id: string;
  hospital_id: number;
  pet_id: number | null;
  status: string;
  last_message_at: string | null;
  last_message_preview: string | null;
  hospitals: unknown;
  pets: unknown;
};

function identityKey(row: ConversationRow) {
  return [
    Number(row.hospital_id),
    String(row.guardian_user_id),
    row.pet_id === null ? "none" : Number(row.pet_id),
  ].join(":");
}

function toTime(value: string | null | undefined) {
  const time = value ? new Date(value).getTime() : 0;
  return Number.isFinite(time) ? time : 0;
}

export async function GET(request: Request) {
  const user = await getAuthUser(readBearer(request));
  if (!user) {
    return NextResponse.json(
      { ok: false, message: "로그인이 필요합니다." },
      { status: 401 },
    );
  }

  const { data, error } = await supabaseAdmin
    .from("chat_conversations")
    .select(
      "id,reservation_id,guardian_user_id,hospital_id,pet_id,status,last_message_at,last_message_preview,hospitals(name),pets(name)",
    )
    .eq("guardian_user_id", user.id)
    .order("last_message_at", {
      ascending: false,
      nullsFirst: false,
    })
    .order("id", { ascending: false });

  if (error) {
    return NextResponse.json(
      { ok: false, message: error.message },
      { status: 400 },
    );
  }

  /*
   * 기존 중복 방은 DB에서 삭제하지 않습니다.
   * 같은 병원+보호자+반려동물 조합 중 최근 활동 방 하나만
   * 목록에 노출합니다.
   */
  const canonical = new Map<string, ConversationRow>();

  for (const raw of data ?? []) {
    const row = raw as ConversationRow;
    const key = identityKey(row);
    const previous = canonical.get(key);

    if (
      !previous ||
      toTime(row.last_message_at) >
        toTime(previous.last_message_at) ||
      (
        toTime(row.last_message_at) ===
          toTime(previous.last_message_at) &&
        Number(row.id) > Number(previous.id)
      )
    ) {
      canonical.set(key, row);
    }
  }

  const conversations = [...canonical.values()].sort(
    (left, right) =>
      toTime(right.last_message_at) -
        toTime(left.last_message_at) ||
      Number(right.id) - Number(left.id),
  );

  return NextResponse.json({
    ok: true,
    conversations,
  });
}

export async function POST(request: Request) {
  const user = await getAuthUser(readBearer(request));
  if (!user) {
    return NextResponse.json(
      { ok: false, message: "로그인이 필요합니다." },
      { status: 401 },
    );
  }

  const body = (await request.json()) as {
    reservationId?: number;
  };

  const reservationId = Number(body.reservationId);
  if (!Number.isInteger(reservationId)) {
    return NextResponse.json(
      { ok: false, message: "예약 정보가 올바르지 않습니다." },
      { status: 400 },
    );
  }

  const { data: reservation } = await supabaseAdmin
    .from("reservations")
    .select("id,user_id,hospital_id,pet_id,status")
    .eq("id", reservationId)
    .maybeSingle();

  if (!reservation || reservation.user_id !== user.id) {
    return NextResponse.json(
      { ok: false, message: "예약을 찾지 못했습니다." },
      { status: 404 },
    );
  }

  if (
    ![
      "approved",
      "arrived",
      "in_progress",
      "payment_pending",
      "completed",
    ].includes(reservation.status)
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "병원에서 승인된 예약부터 채팅을 시작할 수 있습니다.",
      },
      { status: 409 },
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
      { ok: false, message: existingError.message },
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
      {
        ok: false,
        message:
          error?.message ?? "채팅방을 만들지 못했습니다.",
      },
      { status: 400 },
    );
  }

  return NextResponse.json({
    ok: true,
    conversationId: created.id,
    reused: false,
  });
}
