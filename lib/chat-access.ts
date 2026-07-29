import { supabaseAdmin } from "./supabase-admin";

export function readBearer(request: Request) {
  const value = request.headers.get("authorization") ?? "";
  return value.startsWith("Bearer ") ? value.slice(7) : "";
}

export async function getAuthUser(accessToken: string) {
  if (!accessToken) return null;
  const { data, error } = await supabaseAdmin.auth.getUser(accessToken);
  if (error || !data.user) return null;
  return data.user;
}

export async function canAccessConversation(
  conversationId: number,
  userId: string,
) {
  const { data: conversation } = await supabaseAdmin
    .from("chat_conversations")
    .select("id, guardian_user_id, hospital_id")
    .eq("id", conversationId)
    .maybeSingle();

  if (!conversation) return null;

  if (conversation.guardian_user_id === userId) {
    return { conversation, actorType: "guardian" as const };
  }

  const { data: staff } = await supabaseAdmin
    .from("hospital_staff")
    .select("id")
    .eq("user_id", userId)
    .eq("hospital_id", conversation.hospital_id)
    .eq("is_active", true)
    .maybeSingle();

  if (staff) {
    return { conversation, actorType: "hospital" as const };
  }

  const { data: admin } = await supabaseAdmin
    .from("hospital_admins")
    .select("id")
    .eq("user_id", userId)
    .eq("hospital_id", conversation.hospital_id)
    .maybeSingle();

  if (admin) {
    return { conversation, actorType: "hospital" as const };
  }

  return null;
}
