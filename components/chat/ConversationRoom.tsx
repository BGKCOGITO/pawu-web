"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

type Message = {
  id: number;
  sender_user_id: string;
  sender_type: "guardian" | "hospital";
  message_type: string;
  content: string | null;
  file_name: string | null;
  public_url: string | null;
  mime_type: string | null;
  created_at: string;
  read_at: string | null;
};

type Conversation = {
  id: number;
  reservation_id: number;
  status: string;
  hospitals: { name: string } | { name: string }[] | null;
  pets: { name: string } | { name: string }[] | null;
  reservations:
    | {
        guardian_name: string;
        reservation_date: string;
        reservation_time: string;
        status: string;
      }
    | {
        guardian_name: string;
        reservation_date: string;
        reservation_time: string;
        status: string;
      }[]
    | null;
};

function one<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

async function authFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("로그인이 필요합니다.");
  const headers = new Headers(init.headers);
  headers.set("authorization", `Bearer ${token}`);
  return fetch(input, { ...init, headers });
}

export default function ConversationRoom({
  conversationId,
  mode,
}: {
  conversationId: number;
  mode: "guardian" | "hospital";
}) {
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [actorType, setActorType] = useState<"guardian" | "hospital">(mode);
  const [userId, setUserId] = useState("");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const endRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const response = await authFetch(`/api/chat/conversations/${conversationId}`);
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      setConversation(result.conversation);
      setMessages(result.messages ?? []);
      setActorType(result.actorType ?? mode);
      setUserId(result.userId ?? "");
      setError("");

      await authFetch("/api/chat/messages", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ conversationId }),
      });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "채팅을 불러오지 못했습니다.");
    } finally {
      if (!silent) setLoading(false);
    }
  }, [conversationId, mode]);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(true), 5000);
    return () => window.clearInterval(timer);
  }, [load]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const trimmed = content.trim();
    if (!trimmed || sending) return;

    setSending(true);
    setError("");
    try {
      const response = await authFetch("/api/chat/messages", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          conversationId,
          messageType: "text",
          content: trimmed,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      setContent("");
      await load(true);
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "메시지를 보내지 못했습니다.");
    } finally {
      setSending(false);
    }
  }

  const hospital = useMemo(() => one(conversation?.hospitals ?? null), [conversation]);
  const pet = useMemo(() => one(conversation?.pets ?? null), [conversation]);
  const reservation = useMemo(() => one(conversation?.reservations ?? null), [conversation]);

  if (loading) {
    return <main className="min-h-screen bg-slate-50 p-6 text-center text-slate-500">채팅을 불러오는 중입니다.</main>;
  }

  return (
    <main className="min-h-screen bg-slate-100 p-4 text-slate-950 lg:p-6">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-4xl flex-col overflow-hidden border border-slate-300 bg-white shadow-sm">
        <header className="border-b border-slate-200 bg-white p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <Link
                href={mode === "hospital" ? "/hospital-admin/chat" : "/chat"}
                className="text-sm font-bold text-slate-500 hover:text-slate-950"
              >
                ← 채팅 목록
              </Link>
              <h1 className="mt-2 text-xl font-black">
                {mode === "hospital"
                  ? `${reservation?.guardian_name ?? "보호자"} · ${pet?.name ?? "환자"}`
                  : `${hospital?.name ?? "동물병원"} · ${pet?.name ?? "반려동물"}`}
              </h1>
              {reservation && (
                <p className="mt-1 text-sm text-slate-500">
                  예약 #{conversation?.reservation_id} · {reservation.reservation_date} {String(reservation.reservation_time).slice(0, 5)}
                </p>
              )}
            </div>
            {mode === "hospital" && conversation && (
              <Link
                href={`/hospital-admin/reservations/${conversation.reservation_id}`}
                className="border border-slate-950 px-4 py-2 text-sm font-bold"
              >
                예약 상세
              </Link>
            )}
          </div>
        </header>

        {error && (
          <div className="border-b border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <section className="flex-1 space-y-3 overflow-y-auto bg-slate-50 p-4 sm:p-6">
          {messages.length === 0 && (
            <div className="py-20 text-center text-sm text-slate-500">메시지를 보내 대화를 시작하세요.</div>
          )}

          {messages.map((message) => {
            const isMine = message.sender_user_id === userId;
            const isSystem = message.message_type === "system";

            if (isSystem) {
              return (
                <div key={message.id} className="mx-auto max-w-xl rounded-xl bg-slate-200 px-4 py-3 text-center text-sm leading-6 text-slate-700">
                  {message.content}
                </div>
              );
            }

            return (
              <div key={message.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[82%] rounded-2xl px-4 py-3 ${isMine ? "bg-[#153f34] text-white" : "border border-slate-200 bg-white text-slate-900"}`}>
                  <p className="whitespace-pre-wrap break-words text-sm leading-6">{message.content}</p>
                  <p className={`mt-1 text-[10px] ${isMine ? "text-white/60" : "text-slate-400"}`}>
                    {new Date(message.created_at).toLocaleString("ko-KR", {
                      month: "numeric",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>
            );
          })}
          <div ref={endRef} />
        </section>

        <form onSubmit={submit} className="border-t border-slate-200 bg-white p-3 sm:p-4">
          <div className="flex gap-2">
            <textarea
              value={content}
              onChange={(event) => setContent(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  event.currentTarget.form?.requestSubmit();
                }
              }}
              rows={2}
              placeholder={actorType === "hospital" ? "보호자에게 전달할 내용을 입력하세요." : "병원에 문의할 내용을 입력하세요."}
              className="min-w-0 flex-1 resize-none rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-950"
            />
            <button
              type="submit"
              disabled={sending || !content.trim()}
              className="rounded-xl bg-slate-950 px-5 font-bold text-white disabled:bg-slate-400"
            >
              {sending ? "전송 중" : "전송"}
            </button>
          </div>
          <p className="mt-2 text-xs text-slate-400">Enter로 전송 · Shift+Enter로 줄바꿈</p>
        </form>
      </div>
    </main>
  );
}
