import { supabaseAdmin } from "@/lib/supabase-admin";

type ConversationIdentity = {
  hospitalId: number;
  guardianUserId: string;
  petId: number | null;
};

export async function findConversationByIdentity({
  hospitalId,
  guardianUserId,
  petId,
}: ConversationIdentity) {
  let query = supabaseAdmin
    .from("chat_conversations")
    .select("id,reservation_id")
    .eq("hospital_id", hospitalId)
    .eq("guardian_user_id", guardianUserId);

  query =
    petId === null
      ? query.is("pet_id", null)
      : query.eq("pet_id", petId);

  const { data, error } = await query
    .order("last_message_at", {
      ascending: false,
      nullsFirst: false,
    })
    .order("id", { ascending: true })
    .limit(1)
    .maybeSingle();

  return { data, error };
}

export async function attachLatestReservation(
  conversationId: number,
  reservationId: number,
) {
  return supabaseAdmin
    .from("chat_conversations")
    .update({
      reservation_id: reservationId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", conversationId);
}
