import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireHospitalContext } from "@/lib/hospital-api-auth";

type ConversationRow = {
  id: number;
  reservation_id: number | null;
  guardian_user_id: string;
  pet_id: number | null;
  status: string;
  last_message_at: string | null;
  last_message_preview: string | null;
};

function identityKey(row: ConversationRow) {
  return [
    String(row.guardian_user_id),
    row.pet_id === null ? "none" : Number(row.pet_id),
  ].join(":");
}

function toTime(value: string | null | undefined) {
  const time = value ? new Date(value).getTime() : 0;
  return Number.isFinite(time) ? time : 0;
}

export async function GET(request: NextRequest) {
  const context = await requireHospitalContext(request);
  if ("error" in context) {
    return NextResponse.json(
      { message: context.error },
      { status: context.status },
    );
  }

  const { data: conversations, error } = await supabaseAdmin
    .from("chat_conversations")
    .select(
      "id,reservation_id,guardian_user_id,pet_id,status,last_message_at,last_message_preview",
    )
    .eq("hospital_id", context.hospitalId)
    .order("last_message_at", {
      ascending: false,
      nullsFirst: false,
    })
    .order("id", { ascending: false });

  if (error) {
    return NextResponse.json(
      { message: error.message },
      { status: 500 },
    );
  }

  const rows = (conversations ?? []) as ConversationRow[];
  if (rows.length === 0) {
    return NextResponse.json({ conversations: [] });
  }

  const conversationIds = rows.map((row) => Number(row.id));

  const { data: unreadRows, error: unreadError } =
    await supabaseAdmin
      .from("chat_messages")
      .select("conversation_id")
      .in("conversation_id", conversationIds)
      .eq("sender_type", "guardian")
      .is("read_at", null);

  if (unreadError) {
    return NextResponse.json(
      { message: unreadError.message },
      { status: 500 },
    );
  }

  const unreadByConversation = new Map<number, number>();
  for (const row of unreadRows ?? []) {
    const id = Number(
      (row as { conversation_id: number }).conversation_id,
    );
    unreadByConversation.set(
      id,
      (unreadByConversation.get(id) ?? 0) + 1,
    );
  }

  const groups = new Map<
    string,
    {
      canonical: ConversationRow;
      roomIds: number[];
      unreadCount: number;
    }
  >();

  for (const row of rows) {
    const key = identityKey(row);
    const unread =
      unreadByConversation.get(Number(row.id)) ?? 0;
    const existing = groups.get(key);

    if (!existing) {
      groups.set(key, {
        canonical: row,
        roomIds: [Number(row.id)],
        unreadCount: unread,
      });
      continue;
    }

    existing.roomIds.push(Number(row.id));
    existing.unreadCount += unread;

    if (
      toTime(row.last_message_at) >
        toTime(existing.canonical.last_message_at) ||
      (
        toTime(row.last_message_at) ===
          toTime(existing.canonical.last_message_at) &&
        Number(row.id) > Number(existing.canonical.id)
      )
    ) {
      existing.canonical = row;
    }
  }

  const canonicalRows = [...groups.values()]
    .map((group) => ({
      ...group.canonical,
      duplicate_room_ids: group.roomIds,
      unread_count: group.unreadCount,
    }))
    .sort(
      (left, right) =>
        toTime(right.last_message_at) -
          toTime(left.last_message_at) ||
        Number(right.id) - Number(left.id),
    );

  const reservationIds = canonicalRows
    .map((row) => Number(row.reservation_id))
    .filter(Number.isInteger);
  const petIds = canonicalRows
    .map((row) => Number(row.pet_id))
    .filter(Number.isInteger);

  const [reservationsResult, petsResult] =
    await Promise.all([
      reservationIds.length
        ? supabaseAdmin
            .from("reservations")
            .select(
              "id,guardian_name,phone,reservation_date,reservation_time,status",
            )
            .in("id", reservationIds)
        : Promise.resolve({ data: [], error: null }),
      petIds.length
        ? supabaseAdmin
            .from("pets")
            .select("id,name,species,breed")
            .in("id", petIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

  if (reservationsResult.error || petsResult.error) {
    return NextResponse.json(
      {
        message:
          reservationsResult.error?.message ??
          petsResult.error?.message,
      },
      { status: 500 },
    );
  }

  const reservations = new Map(
    (reservationsResult.data ?? []).map((row: any) => [
      Number(row.id),
      row,
    ]),
  );
  const pets = new Map(
    (petsResult.data ?? []).map((row: any) => [
      Number(row.id),
      row,
    ]),
  );

  return NextResponse.json({
    conversations: canonicalRows.map((row) => ({
      ...row,
      reservation:
        reservations.get(Number(row.reservation_id)) ?? null,
      pet: pets.get(Number(row.pet_id)) ?? null,
    })),
  });
}
