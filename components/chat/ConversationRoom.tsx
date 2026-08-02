"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import GuardianBottomNav from "@/components/GuardianBottomNav";

type Message = {
  id: number;
  sender_user_id: string;
  sender_type: "guardian" | "hospital";
  message_type: string;
  content: string | null;
  created_at: string;
};

type Conversation = {
  id: number;
  reservation_id: number;
  hospitals: { name: string } | { name: string }[] | null;
  pets: { name: string } | { name: string }[] | null;
  reservations:
    | { guardian_name: string; reservation_date: string; reservation_time: string; status: string }
    | { guardian_name: string; reservation_date: string; reservation_time: string; status: string }[]
    | null;
};

type ChatContext = {
  guardian?: { name?: string | null; phone?: string | null } | null;
  pet?: {
    id?: number;
    name?: string;
    species?: string;
    breed?: string | null;
    birth_date?: string | null;
    gender?: string | null;
    weight_kg?: number | null;
    notes?: string | null;
  } | null;
  reservation?: {
    visit_reason?: string | null;
    symptoms?: string | null;
    preparation_summary?: string | null;
  } | null;
  linkedEvents?: any[];
  recentEvents?: any[];
  emrRecords?: any[];
  medicalRecords?: any[];
};

function one<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

function dateLabel(value?: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("ko-KR");
}

function speciesLabel(value?: string | null) {
  if (value === "dog") return "강아지";
  if (value === "cat") return "고양이";
  return value || "기타";
}

async function authFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("로그인이 필요합니다.");
  const headers = new Headers(init.headers);
  headers.set("authorization", `Bearer ${token}`);
  return fetch(input, { ...init, headers });
}

function PatientContextPanel({ context }: { context: ChatContext | null }) {
  const pet = context?.pet;
  const records = [
    ...(context?.emrRecords ?? []).map((record) => ({
      id: `emr-${record.id}`,
      date: record.finalized_at ?? record.created_at,
      title: record.diagnosis_summary || record.assessment || "전자차트 기록",
      detail: record.treatment_summary || record.plan || record.guardian_summary || "상세 내용 없음",
    })),
    ...(context?.medicalRecords ?? []).map((record) => ({
      id: `medical-${record.id}`,
      date: record.completed_at ?? record.created_at,
      title: record.diagnosis || record.chief_complaint || "진료 기록",
      detail: record.treatment || record.follow_up || "상세 내용 없음",
    })),
  ].sort((a, b) => new Date(b.date ?? 0).getTime() - new Date(a.date ?? 0).getTime()).slice(0, 5);

  const events = (context?.linkedEvents?.length ? context.linkedEvents : context?.recentEvents ?? []).slice(0, 8);

  return (
    <aside className="space-y-4 bg-white p-5 lg:h-full lg:overflow-y-auto lg:border-l lg:border-slate-200">
      <section>
        <p className="text-xs font-black tracking-[0.16em] text-[#d86c57]">GUARDIAN</p>
        <h2 className="mt-1 text-lg font-black text-[#153f34]">보호자 정보</h2>
        <dl className="mt-3 space-y-2 rounded-2xl bg-slate-50 p-4 text-sm">
          <div className="flex justify-between gap-4"><dt className="text-slate-500">이름</dt><dd className="font-bold">{context?.guardian?.name || "-"}</dd></div>
          <div className="flex justify-between gap-4"><dt className="text-slate-500">연락처</dt><dd className="font-bold">{context?.guardian?.phone || "-"}</dd></div>
        </dl>
      </section>

      <section>
        <p className="text-xs font-black tracking-[0.16em] text-[#d86c57]">PATIENT</p>
        <h2 className="mt-1 text-lg font-black text-[#153f34]">반려동물 정보</h2>
        <dl className="mt-3 grid grid-cols-2 gap-2 rounded-2xl bg-[#eef5f1] p-4 text-sm">
          <div><dt className="text-slate-500">이름</dt><dd className="mt-1 font-black">{pet?.name || "-"}</dd></div>
          <div><dt className="text-slate-500">종류</dt><dd className="mt-1 font-black">{speciesLabel(pet?.species)}</dd></div>
          <div><dt className="text-slate-500">품종</dt><dd className="mt-1 font-black">{pet?.breed || "미입력"}</dd></div>
          <div><dt className="text-slate-500">성별</dt><dd className="mt-1 font-black">{pet?.gender || "미입력"}</dd></div>
          <div><dt className="text-slate-500">생년월일</dt><dd className="mt-1 font-black">{pet?.birth_date || "미입력"}</dd></div>
          <div><dt className="text-slate-500">체중</dt><dd className="mt-1 font-black">{pet?.weight_kg != null ? `${pet.weight_kg}kg` : "미입력"}</dd></div>
        </dl>
        {pet?.notes && <p className="mt-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-900">{pet.notes}</p>}
      </section>

      <section>
        <h2 className="text-lg font-black text-[#153f34]">이번 예약 내용</h2>
        <div className="mt-3 rounded-2xl border border-slate-200 p-4 text-sm leading-6">
          <p><span className="font-bold">방문 목적:</span> {context?.reservation?.visit_reason || "미입력"}</p>
          <p className="mt-2 whitespace-pre-wrap"><span className="font-bold">증상:</span> {context?.reservation?.symptoms || "미입력"}</p>
          {context?.reservation?.preparation_summary && (
            <p className="mt-3 rounded-xl bg-slate-50 p-3 whitespace-pre-wrap">{context.reservation.preparation_summary}</p>
          )}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-black text-[#153f34]">기존 진료 내용</h2>
        <div className="mt-3 space-y-2">
          {records.length === 0 ? <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">이 병원의 이전 진료기록이 없습니다.</p> : records.map((record) => (
            <article key={record.id} className="rounded-2xl border border-slate-200 p-4">
              <p className="text-xs font-bold text-[#d86c57]">{dateLabel(record.date)}</p>
              <h3 className="mt-1 font-black text-[#153f34]">{record.title}</h3>
              <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-600">{record.detail}</p>
            </article>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-black text-[#153f34]">건강 이벤트</h2>
        <div className="mt-3 space-y-2">
          {events.length === 0 ? <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">공유된 건강 이벤트가 없습니다.</p> : events.map((event: any) => (
            <article key={event.id} className="rounded-2xl border border-slate-200 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-bold text-[#d86c57]">{dateLabel(event.occurred_at)}</p>
                <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold">{event.priority || event.severity || "보통"}</span>
              </div>
              <h3 className="mt-1 font-black text-[#153f34]">{event.title || event.event_type || "건강 이벤트"}{event.count_value ? ` · ${event.count_value}회` : ""}</h3>
              {event.note && <p className="mt-2 text-sm leading-6 text-slate-600">{event.note}</p>}
            </article>
          ))}
        </div>
      </section>
    </aside>
  );
}

export default function ConversationRoom({ conversationId, mode }: { conversationId: number; mode: "guardian" | "hospital" }) {
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [context, setContext] = useState<ChatContext | null>(null);
  const [actorType, setActorType] = useState<"guardian" | "hospital">(mode);
  const [userId, setUserId] = useState("");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [showInfo, setShowInfo] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);
  const loadInFlightRef = useRef<Promise<void> | null>(null);
  const lastRefreshAtRef = useRef(0);
  const userIdRef = useRef("");

  const markAsRead = useCallback(async () => {
    try {
      await authFetch("/api/chat/messages", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ conversationId }),
      });
      window.dispatchEvent(new Event("pawu:chat-read"));
    } catch {
      // 읽음 처리 실패는 메시지 표시를 막지 않습니다.
    }
  }, [conversationId]);

  const load = useCallback(async (silent = false) => {
    if (loadInFlightRef.current) return loadInFlightRef.current;

    const task = (async () => {
      if (!silent) setLoading(true);
      try {
        const response = await authFetch(`/api/chat/conversations/${conversationId}`);
        const result = await response.json();
        if (!response.ok) throw new Error(result.message);
        setConversation(result.conversation);
        setMessages(result.messages ?? []);
        setContext(result.context ?? null);
        setActorType(result.actorType ?? mode);
        const nextUserId = result.userId ?? "";
        setUserId(nextUserId);
        userIdRef.current = nextUserId;
        setError("");
        lastRefreshAtRef.current = Date.now();
        void markAsRead();
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "채팅을 불러오지 못했습니다.");
      } finally {
        if (!silent) setLoading(false);
        loadInFlightRef.current = null;
      }
    })();

    loadInFlightRef.current = task;
    return task;
  }, [conversationId, markAsRead, mode]);

  useEffect(() => {
    void load();

    const channel = supabase
      .channel(`pawu-chat-${conversationId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages", filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          const incoming = payload.new as Message;
          setMessages((current) => current.some((message) => message.id === incoming.id) ? current : [...current, incoming]);
          if (incoming.sender_user_id !== userIdRef.current) void markAsRead();
        },
      )
      .subscribe();

    const refreshIfNeeded = () => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - lastRefreshAtRef.current < 10_000) return;
      void load(true);
    };

    document.addEventListener("visibilitychange", refreshIfNeeded);
    window.addEventListener("focus", refreshIfNeeded);
    window.addEventListener("pageshow", refreshIfNeeded);

    return () => {
      document.removeEventListener("visibilitychange", refreshIfNeeded);
      window.removeEventListener("focus", refreshIfNeeded);
      window.removeEventListener("pageshow", refreshIfNeeded);
      void supabase.removeChannel(channel);
    };
  }, [conversationId, load, markAsRead]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages.length]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const trimmed = content.trim();
    if (!trimmed || sending) return;
    setSending(true);
    try {
      const response = await authFetch("/api/chat/messages", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ conversationId, messageType: "text", content: trimmed }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      setContent("");
      const createdMessage = result.message as Message | undefined;
      if (createdMessage) {
        setMessages((current) => current.some((message) => message.id === createdMessage.id) ? current : [...current, createdMessage]);
      }
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "메시지를 보내지 못했습니다.");
    } finally { setSending(false); }
  }

  const hospital = useMemo(() => one(conversation?.hospitals ?? null), [conversation]);
  const pet = useMemo(() => one(conversation?.pets ?? null), [conversation]);
  const reservation = useMemo(() => one(conversation?.reservations ?? null), [conversation]);

  if (loading) return <main className="min-h-screen bg-slate-50 p-6 text-center text-slate-500">채팅을 불러오는 중입니다.</main>;

  return (
    <main className={`${mode === "guardian" ? "pb-28" : ""} min-h-screen bg-slate-100 text-slate-950`}>
      <div className={`mx-auto grid min-h-screen bg-white shadow-sm ${mode === "hospital" ? "max-w-[1440px] lg:grid-cols-[minmax(0,1fr)_380px]" : "max-w-4xl"}`}>
        <div className="flex min-h-screen min-w-0 flex-col">
          <header className="border-b border-slate-200 bg-white p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <Link href={mode === "hospital" ? "/hospital-admin/chat" : "/chat"} className="text-sm font-bold text-slate-500">← 채팅 목록</Link>
                <h1 className="mt-2 truncate text-xl font-black">{mode === "hospital" ? `${reservation?.guardian_name ?? "보호자"} · ${pet?.name ?? "환자"}` : `${hospital?.name ?? "동물병원"} · ${pet?.name ?? "반려동물"}`}</h1>
                {reservation && <p className="mt-1 text-sm text-slate-500">예약 #{conversation?.reservation_id} · {reservation.reservation_date} {String(reservation.reservation_time).slice(0, 5)}</p>}
              </div>
              <div className="flex gap-2">
                {mode === "hospital" && <button type="button" onClick={() => setShowInfo(true)} className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-bold lg:hidden">환자정보</button>}
                {mode === "hospital" && conversation && <Link href={`/hospital-admin/reservations/${conversation.reservation_id}`} className="rounded-xl border border-slate-950 px-3 py-2 text-sm font-bold">예약 상세</Link>}
              </div>
            </div>
          </header>

          {error && <div className="border-b border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

          <section className="flex-1 space-y-3 overflow-y-auto bg-slate-50 p-4 sm:p-6">
            {messages.length === 0 && <div className="py-20 text-center text-sm text-slate-500">메시지를 보내 대화를 시작하세요.</div>}
            {messages.map((message) => {
              const isMine = message.sender_user_id === userId;
              if (message.message_type === "system") return <div key={message.id} className="mx-auto max-w-xl rounded-xl bg-slate-200 px-4 py-3 text-center text-sm leading-6 text-slate-700">{message.content}</div>;
              return <div key={message.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}><div className={`max-w-[82%] rounded-2xl px-4 py-3 ${isMine ? "bg-[#153f34] text-white" : "border border-slate-200 bg-white"}`}><p className="whitespace-pre-wrap break-words text-sm leading-6">{message.content}</p><p className={`mt-1 text-[10px] ${isMine ? "text-white/60" : "text-slate-400"}`}>{new Date(message.created_at).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}</p></div></div>;
            })}
            <div ref={endRef} />
          </section>

          <form onSubmit={submit} className="sticky bottom-0 border-t border-slate-200 bg-white p-3 sm:p-4">
            <div className="flex gap-2"><textarea value={content} onChange={(e) => setContent(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); e.currentTarget.form?.requestSubmit(); } }} rows={2} placeholder={actorType === "hospital" ? "보호자에게 전달할 내용을 입력하세요." : "병원에 문의할 내용을 입력하세요."} className="min-w-0 flex-1 resize-none rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-950"/><button type="submit" disabled={sending || !content.trim()} className="rounded-xl bg-slate-950 px-5 font-bold text-white disabled:bg-slate-400">{sending ? "전송 중" : "전송"}</button></div>
          </form>
        </div>

        {mode === "hospital" && <div className="hidden lg:block"><PatientContextPanel context={context} /></div>}
      </div>

      {showInfo && <div className="fixed inset-0 z-[100] bg-black/50 lg:hidden"><div className="absolute inset-y-0 right-0 w-[90%] max-w-md overflow-y-auto bg-white"><div className="sticky top-0 z-10 flex justify-end border-b bg-white p-3"><button type="button" onClick={() => setShowInfo(false)} className="rounded-xl border px-4 py-2 font-bold">닫기</button></div><PatientContextPanel context={context} /></div></div>}
      {mode === "guardian" && <GuardianBottomNav />}
    </main>
  );
}
