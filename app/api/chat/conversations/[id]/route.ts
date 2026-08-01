import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { canAccessConversation, getAuthUser, readBearer } from "@/lib/chat-access";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getAuthUser(readBearer(request));
  if (!user) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }

  const { id } = await params;
  const conversationId = Number(id);
  if (!Number.isInteger(conversationId)) {
    return NextResponse.json({ message: "채팅방 정보가 올바르지 않습니다." }, { status: 400 });
  }

  const access = await canAccessConversation(conversationId, user.id);
  if (!access) {
    return NextResponse.json({ message: "채팅방 접근 권한이 없습니다." }, { status: 403 });
  }

  const [{ data: conversation, error: conversationError }, { data: messages, error: messagesError }] = await Promise.all([
    supabaseAdmin
      .from("chat_conversations")
      .select(`
        id,reservation_id,status,last_message_at,
        hospitals(name),pets(name),
        reservations(guardian_name,reservation_date,reservation_time,status)
      `)
      .eq("id", conversationId)
      .single(),
    supabaseAdmin
      .from("chat_messages")
      .select("id,sender_user_id,sender_type,message_type,content,file_name,public_url,mime_type,created_at,read_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })
      .limit(500),
  ]);

  if (conversationError || messagesError || !conversation) {
    return NextResponse.json(
      { message: conversationError?.message ?? messagesError?.message ?? "채팅을 불러오지 못했습니다." },
      { status: 500 },
    );
  }

  return NextResponse.json({
    conversation,
    messages: messages ?? [],
    actorType: access.actorType,
    userId: user.id,
  });
}
