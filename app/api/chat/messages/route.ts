import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabase-admin";
import {
  canAccessConversation,
  getAuthUser,
  readBearer,
} from "../../../../lib/chat-access";

export async function POST(request: Request) {
  const user = await getAuthUser(readBearer(request));
  if (!user) {
    return NextResponse.json({ ok: false, message: "로그인이 필요합니다." }, { status: 401 });
  }

  const body = (await request.json()) as {
    conversationId?: number;
    messageType?: string;
    content?: string;
    fileName?: string | null;
    filePath?: string | null;
    publicUrl?: string | null;
    mimeType?: string | null;
    fileSize?: number | null;
  };

  const conversationId = Number(body.conversationId);
  const messageType = String(body.messageType ?? "text");
  const content = String(body.content ?? "").trim();

  if (!Number.isInteger(conversationId)) {
    return NextResponse.json({ ok: false, message: "채팅방 정보가 올바르지 않습니다." }, { status: 400 });
  }

  const access = await canAccessConversation(conversationId, user.id);
  if (!access) {
    return NextResponse.json({ ok: false, message: "채팅방 접근 권한이 없습니다." }, { status: 403 });
  }

  if (messageType === "text" && !content) {
    return NextResponse.json({ ok: false, message: "메시지를 입력해 주세요." }, { status: 400 });
  }

  if (!["text", "image", "video", "file", "system"].includes(messageType)) {
    return NextResponse.json({ ok: false, message: "지원하지 않는 메시지 형식입니다." }, { status: 400 });
  }

  const { data: created, error } = await supabaseAdmin
    .from("chat_messages")
    .insert({
      conversation_id: conversationId,
      sender_user_id: user.id,
      sender_type: access.actorType,
      message_type: messageType,
      content: content || null,
      file_name: body.fileName ?? null,
      file_path: body.filePath ?? null,
      public_url: body.publicUrl ?? null,
      mime_type: body.mimeType ?? null,
      file_size: body.fileSize ?? null,
    })
    .select("id, created_at")
    .single();

  if (error || !created) {
    return NextResponse.json(
      { ok: false, message: error?.message ?? "메시지를 보내지 못했습니다." },
      { status: 400 },
    );
  }

  await supabaseAdmin
    .from("chat_conversations")
    .update({
      last_message_at: created.created_at,
      last_message_preview:
        messageType === "text"
          ? content.slice(0, 120)
          : body.fileName ?? "첨부파일",
    })
    .eq("id", conversationId);

  return NextResponse.json({ ok: true, messageId: created.id });
}

export async function PATCH(request: Request) {
  const user = await getAuthUser(readBearer(request));
  if (!user) {
    return NextResponse.json({ ok: false, message: "로그인이 필요합니다." }, { status: 401 });
  }

  const body = (await request.json()) as { conversationId?: number };
  const conversationId = Number(body.conversationId);

  const access = await canAccessConversation(conversationId, user.id);
  if (!access) {
    return NextResponse.json({ ok: false, message: "채팅방 접근 권한이 없습니다." }, { status: 403 });
  }

  const { error } = await supabaseAdmin
    .from("chat_messages")
    .update({ read_at: new Date().toISOString() })
    .eq("conversation_id", conversationId)
    .neq("sender_user_id", user.id)
    .is("read_at", null);

  if (error) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
