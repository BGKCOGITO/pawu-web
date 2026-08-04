import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabase-admin";
import {
  canAccessConversation,
  getAuthUser,
  readBearer,
} from "../../../../lib/chat-access";
import { sendGuardianChatPush } from "../../../../lib/push/fcm-admin";


export async function GET(request: Request) {
  const user = await getAuthUser(readBearer(request));
  if (!user) {
    return NextResponse.json(
      { ok: false, message: "로그인이 필요합니다." },
      {
        status: 401,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      },
    );
  }

  const url = new URL(request.url);
  const conversationId = Number(url.searchParams.get("conversationId"));
  const afterId = Number(url.searchParams.get("afterId") ?? "0");

  if (!Number.isInteger(conversationId)) {
    return NextResponse.json(
      { ok: false, message: "채팅방 정보가 올바르지 않습니다." },
      {
        status: 400,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      },
    );
  }

  const access = await canAccessConversation(conversationId, user.id);
  if (!access) {
    return NextResponse.json(
      { ok: false, message: "채팅방 접근 권한이 없습니다." },
      {
        status: 403,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      },
    );
  }

  let query = supabaseAdmin
    .from("chat_messages")
    .select(
      "id,sender_user_id,sender_type,message_type,content,file_name,public_url,mime_type,created_at,read_at",
    )
    .eq("conversation_id", conversationId)
    .order("id", { ascending: true })
    .limit(200);

  if (Number.isInteger(afterId) && afterId > 0) {
    query = query.gt("id", afterId);
  }

  const { data: messages, error } = await query;

  if (error) {
    return NextResponse.json(
      { ok: false, message: error.message },
      {
        status: 400,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      },
    );
  }

  return NextResponse.json(
    {
      ok: true,
      messages: messages ?? [],
    },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    },
  );
}

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
    .select(
      "id,sender_user_id,sender_type,message_type,content,file_name,public_url,mime_type,created_at,read_at",
    )
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

  if (access.actorType === "hospital") {
    const { data: conversation } = await supabaseAdmin
      .from("chat_conversations")
      .select("guardian_user_id,hospital_id,hospitals(name)")
      .eq("id", conversationId)
      .maybeSingle();

    const guardianUserId = conversation?.guardian_user_id;
    if (guardianUserId) {
      const { data: preference } = await supabaseAdmin
        .from("notification_preferences")
        .select("chat_messages")
        .eq("user_id", guardianUserId)
        .maybeSingle();

      if (preference?.chat_messages !== false) {
        const hospitalValue = (conversation as any)?.hospitals;
        const hospital = Array.isArray(hospitalValue) ? hospitalValue[0] : hospitalValue;
        const preview = messageType === "text" ? content.slice(0, 100) : body.fileName ?? "첨부파일을 보냈습니다.";

        const pushTitle = `${hospital?.name ?? "동물병원"}에서 새 메시지가 왔습니다`;
        const pushUrl = `/chat/${conversationId}`;
        const pushTag = `pawu-chat-${conversationId}`;

        await supabaseAdmin.from("notifications").insert({
          user_id: guardianUserId,
          type: "chat_message",
          title: pushTitle,
          body: preview,
          link_url: pushUrl,
          metadata: {
            conversation_id: conversationId,
            hospital_id: conversation?.hospital_id,
          },
        });

        // 앱이 종료되거나 백그라운드에 있어도 바로 울리도록
        // Vercel 서버에서 FCM을 직접 발송한다.
        // DB trigger가 만든 push_jobs는 직접 발송 성공 시 sent 처리하여
        // Edge Function worker와의 중복 알림을 방지한다.
        try {
          const pushResult = await sendGuardianChatPush(
            guardianUserId,
            {
              title: pushTitle,
              body: preview,
              url: pushUrl,
              tag: pushTag,
            },
          );

          if (pushResult.sent > 0) {
            const { data: queuedJob } = await supabaseAdmin
              .from("push_jobs")
              .select("id")
              .eq("source_type", "chat_message")
              .eq("source_id", created.id)
              .eq("user_id", guardianUserId)
              .maybeSingle();

            if (queuedJob?.id) {
              await supabaseAdmin.rpc("finish_push_job", {
                p_job_id: queuedJob.id,
                p_status: "sent",
                p_error: null,
              });
            }
          } else {
            console.warn(
              "PAWU guardian chat push skipped:",
              pushResult.reason ?? "unknown",
            );
          }
        } catch (pushError) {
          // 직접 발송 실패 시 DB trigger로 생성된 push_jobs를 남겨
          // Edge Function worker가 재시도할 수 있도록 한다.
          console.error(
            "PAWU guardian chat direct push failed:",
            pushError,
          );
        }
      }
    }
  }

  return NextResponse.json(
    {
      ok: true,
      messageId: created.id,
      message: created,
    },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    },
  );
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
