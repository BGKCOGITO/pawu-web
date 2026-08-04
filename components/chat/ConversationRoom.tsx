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

type HospitalConversationListItem = {
  id: number;
  reservation_id: number;
  status: string;
  last_message_at: string | null;
  last_message_preview: string | null;
  unread_count: number;
  pet: {
    name: string;
    species: string | null;
    breed: string | null;
  } | null;
  reservation: {
    guardian_name: string | null;
    phone: string | null;
    reservation_date: string | null;
    reservation_time: string | null;
    status: string | null;
  } | null;
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


type TauriInvoke = (
  command: string,
  args?: Record<string, unknown>,
) => Promise<unknown>;

function getTauriInvoke(): TauriInvoke | null {
  if (typeof window === "undefined") return null;

  const tauriWindow = window as Window & {
    __TAURI__?: {
      core?: {
        invoke?: TauriInvoke;
      };
    };
  };

  return tauriWindow.__TAURI__?.core?.invoke ?? null;
}

async function sendHospitalDesktopNotification(
  message: Pick<Message, "sender_type" | "content">,
) {
  if (message.sender_type !== "guardian") return;

  const body =
    message.content?.trim().slice(0, 120) ||
    "보호자가 새 메시지를 보냈습니다.";

  const invoke = getTauriInvoke();

  if (invoke) {
    try {
      await invoke("send_pawu_notification", {
        title: "PAWU Hospital · 새 보호자 채팅",
        body,
      });
      return;
    } catch (notificationError) {
      console.warn(
        "PAWU Hospital Windows 알림 전송 실패:",
        notificationError,
      );
    }
  }

  if (
    "Notification" in window &&
    Notification.permission === "granted"
  ) {
    new Notification("PAWU Hospital · 새 보호자 채팅", {
      body,
    });
  }
}


function HospitalConversationSidebar({
  activeConversationId,
}: {
  activeConversationId: number;
}) {
  const [items, setItems] = useState<HospitalConversationListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const requestInFlightRef = useRef(false);
  const refreshTimerRef = useRef<number | null>(null);

  const load = useCallback(async () => {
    if (requestInFlightRef.current) return;

    requestInFlightRef.current = true;

    try {
      const response = await authFetch(
        "/api/hospital/chat/conversations",
        { cache: "no-store" },
      );
      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.message ?? "채팅 목록을 불러오지 못했습니다.",
        );
      }

      setItems(
        (result.conversations ?? []) as HospitalConversationListItem[],
      );
      setError("");
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "채팅 목록을 불러오지 못했습니다.",
      );
    } finally {
      requestInFlightRef.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const scheduleRefresh = () => {
      if (refreshTimerRef.current) {
        window.clearTimeout(refreshTimerRef.current);
      }

      refreshTimerRef.current = window.setTimeout(
        () => void load(),
        200,
      );
    };

    const channel = supabase
      .channel(`pawu-hospital-room-list-${activeConversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
        },
        (payload) => {
          const incoming = payload.new as Message & {
            conversation_id?: number;
          };

          scheduleRefresh();

          if (incoming.sender_type === "guardian") {
            void sendHospitalDesktopNotification(incoming);
          }
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "chat_conversations",
        },
        scheduleRefresh,
      )
      .subscribe();

    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") {
        void load();
      }
    };

    void load();
    document.addEventListener(
      "visibilitychange",
      refreshWhenVisible,
    );
    window.addEventListener("focus", refreshWhenVisible);

    return () => {
      document.removeEventListener(
        "visibilitychange",
        refreshWhenVisible,
      );
      window.removeEventListener("focus", refreshWhenVisible);

      if (refreshTimerRef.current) {
        window.clearTimeout(refreshTimerRef.current);
      }

      void supabase.removeChannel(channel);
    };
  }, [activeConversationId, load]);

  return (
    <aside className="hidden h-full min-h-0 border-r border-slate-200 bg-white lg:flex lg:flex-col">
      <div className="shrink-0 border-b border-slate-200 px-3 py-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-[10px] font-black tracking-[0.14em] text-[#d86c57]">
              CONVERSATIONS
            </p>
            <h2 className="mt-0.5 text-sm font-black text-[#153f34]">
              채팅 목록
            </h2>
          </div>
          <Link
            href="/hospital-admin/chat"
            className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-[11px] font-bold"
          >
            전체
          </Link>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading ? (
          <p className="px-3 py-5 text-xs text-slate-500">
            채팅 목록을 불러오는 중입니다.
          </p>
        ) : error ? (
          <div className="m-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs leading-5 text-red-700">
            {error}
          </div>
        ) : items.length === 0 ? (
          <p className="px-3 py-5 text-xs text-slate-500">
            열린 채팅이 없습니다.
          </p>
        ) : (
          <div className="divide-y divide-slate-100">
            {items.map((item) => {
              const active = item.id === activeConversationId;

              return (
                <Link
                  key={item.id}
                  href={`/hospital-admin/chat/${item.id}`}
                  className={`relative block px-3 py-3 transition ${
                    active
                      ? "bg-[#eef5f1]"
                      : "bg-white hover:bg-slate-50"
                  }`}
                >
                  {active && (
                    <span className="absolute inset-y-0 left-0 w-1 bg-[#153f34]" />
                  )}

                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-black text-[#153f34]">
                        {item.reservation?.guardian_name ?? "보호자"} ·{" "}
                        {item.pet?.name ?? "환자"}
                      </p>
                      <p className="mt-1 truncate text-[11px] text-slate-500">
                        {item.last_message_preview ?? "새 채팅"}
                      </p>
                    </div>

                    {item.unread_count > 0 && !active && (
                      <strong className="min-w-5 shrink-0 rounded-full bg-red-500 px-1.5 py-0.5 text-center text-[10px] text-white">
                        {item.unread_count > 99
                          ? "99+"
                          : item.unread_count}
                      </strong>
                    )}
                  </div>

                  <div className="mt-2 flex items-center justify-between gap-2 text-[10px] text-slate-400">
                    <span className="truncate">
                      {item.reservation?.reservation_date ?? "-"}{" "}
                      {String(
                        item.reservation?.reservation_time ?? "",
                      ).slice(0, 5)}
                    </span>
                    <span className="shrink-0">
                      {item.last_message_at
                        ? new Date(
                            item.last_message_at,
                          ).toLocaleDateString("ko-KR", {
                            month: "numeric",
                            day: "numeric",
                          })
                        : ""}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
}

function PatientContextPanel({ context }: { context: ChatContext | null }) {
  const pet = context?.pet;
  const records = [
    ...(context?.emrRecords ?? []).map((record) => ({
      id: `emr-${record.id}`,
      date: record.finalized_at ?? record.created_at,
      title: record.diagnosis_summary || record.assessment || "전자차트 기록",
      detail:
        record.treatment_summary ||
        record.plan ||
        record.guardian_summary ||
        "상세 내용 없음",
    })),
    ...(context?.medicalRecords ?? []).map((record) => ({
      id: `medical-${record.id}`,
      date: record.completed_at ?? record.created_at,
      title: record.diagnosis || record.chief_complaint || "진료 기록",
      detail: record.treatment || record.follow_up || "상세 내용 없음",
    })),
  ]
    .sort(
      (a, b) =>
        new Date(b.date ?? 0).getTime() -
        new Date(a.date ?? 0).getTime(),
    )
    .slice(0, 3);

  const events = (
    context?.linkedEvents?.length
      ? context.linkedEvents
      : context?.recentEvents ?? []
  ).slice(0, 3);

  return (
    <aside className="h-full overflow-y-auto border-l border-slate-200 bg-white p-3">
      <div className="space-y-3">
        <section className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-black tracking-[0.14em] text-[#d86c57]">
                GUARDIAN
              </p>
              <p className="truncate text-sm font-black text-[#153f34]">
                {context?.guardian?.name || "-"}
              </p>
            </div>
            <p className="shrink-0 text-xs font-bold text-slate-700">
              {context?.guardian?.phone || "-"}
            </p>
          </div>
        </section>

        <section className="rounded-xl border border-[#dce9e3] bg-[#eef5f1] px-3 py-2.5">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-black tracking-[0.14em] text-[#d86c57]">
                PATIENT
              </p>
              <p className="truncate text-sm font-black text-[#153f34]">
                {pet?.name || "-"} · {speciesLabel(pet?.species)}
              </p>
            </div>
            <p className="shrink-0 text-xs font-black text-[#153f34]">
              {pet?.weight_kg != null ? `${pet.weight_kg}kg` : "체중 미입력"}
            </p>
          </div>

          <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
            <div className="flex min-w-0 gap-1.5">
              <dt className="shrink-0 text-slate-500">품종</dt>
              <dd className="truncate font-bold">{pet?.breed || "미입력"}</dd>
            </div>
            <div className="flex min-w-0 gap-1.5">
              <dt className="shrink-0 text-slate-500">성별</dt>
              <dd className="truncate font-bold">{pet?.gender || "미입력"}</dd>
            </div>
            <div className="col-span-2 flex min-w-0 gap-1.5">
              <dt className="shrink-0 text-slate-500">생일</dt>
              <dd className="truncate font-bold">
                {pet?.birth_date || "미입력"}
              </dd>
            </div>
          </dl>

          {pet?.notes && (
            <p className="mt-2 line-clamp-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-xs leading-5 text-amber-900">
              {pet.notes}
            </p>
          )}
        </section>

        <section className="rounded-xl border border-slate-200 bg-white px-3 py-2.5">
          <h2 className="text-xs font-black text-[#153f34]">이번 예약</h2>
          <div className="mt-1.5 space-y-1 text-xs leading-5">
            <p className="line-clamp-2">
              <span className="font-bold">목적</span>
              <span className="ml-2 text-slate-600">
                {context?.reservation?.visit_reason || "미입력"}
              </span>
            </p>
            <p className="line-clamp-2">
              <span className="font-bold">증상</span>
              <span className="ml-2 text-slate-600">
                {context?.reservation?.symptoms || "미입력"}
              </span>
            </p>
          </div>
        </section>

        <section>
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-black text-[#153f34]">최근 진료</h2>
            <span className="text-[10px] text-slate-400">최근 3건</span>
          </div>
          <div className="mt-1.5 space-y-1.5">
            {records.length === 0 ? (
              <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
                이전 진료기록이 없습니다.
              </p>
            ) : (
              records.map((record) => (
                <article
                  key={record.id}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="min-w-0 truncate text-xs font-black text-[#153f34]">
                      {record.title}
                    </h3>
                    <p className="shrink-0 text-[10px] font-bold text-[#d86c57]">
                      {dateLabel(record.date)}
                    </p>
                  </div>
                  <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-slate-600">
                    {record.detail}
                  </p>
                </article>
              ))
            )}
          </div>
        </section>

        <section>
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-black text-[#153f34]">건강 이벤트</h2>
            <span className="text-[10px] text-slate-400">최근 3건</span>
          </div>
          <div className="mt-1.5 space-y-1.5">
            {events.length === 0 ? (
              <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
                공유된 건강 이벤트가 없습니다.
              </p>
            ) : (
              events.map((event: any) => (
                <article
                  key={event.id}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="min-w-0 truncate text-xs font-black text-[#153f34]">
                      {event.title || event.event_type || "건강 이벤트"}
                      {event.count_value ? ` · ${event.count_value}회` : ""}
                    </h3>
                    <p className="shrink-0 text-[10px] font-bold text-[#d86c57]">
                      {dateLabel(event.occurred_at)}
                    </p>
                  </div>
                  {event.note && (
                    <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-slate-600">
                      {event.note}
                    </p>
                  )}
                </article>
              ))
            )}
          </div>
        </section>
      </div>
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
  const lastMessageIdRef = useRef(0);
  const deltaInFlightRef = useRef(false);
  const optimisticIdRef = useRef(-1);

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
        const loadedMessages = (result.messages ?? []) as Message[];
        setMessages(loadedMessages);
        lastMessageIdRef.current = loadedMessages.length ? Math.max(...loadedMessages.map((message) => Number(message.id) || 0)) : 0;
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
          lastMessageIdRef.current = Math.max(lastMessageIdRef.current, Number(incoming.id) || 0);
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

    const syncNewMessages = async () => {
      if (document.visibilityState !== "visible" || deltaInFlightRef.current) return;
      deltaInFlightRef.current = true;
      try {
        const response = await authFetch(`/api/chat/messages?conversationId=${conversationId}&afterId=${lastMessageIdRef.current}`);
        const result = await response.json();
        if (!response.ok) return;
        const incomingMessages = (result.messages ?? []) as Message[];
        if (incomingMessages.length === 0) return;

        lastMessageIdRef.current = Math.max(
          lastMessageIdRef.current,
          ...incomingMessages.map((message) => Number(message.id) || 0),
        );
        setMessages((current) => {
          const known = new Set(current.map((message) => message.id));
          return [...current, ...incomingMessages.filter((message) => !known.has(message.id))];
        });
        if (incomingMessages.some((message) => message.sender_user_id !== userIdRef.current)) {
          void markAsRead();
        }
      } catch {
        // Realtime 연결이 잠시 끊겨도 다음 동기화에서 다시 받습니다.
      } finally {
        deltaInFlightRef.current = false;
      }
    };

    const deltaTimer = window.setInterval(() => void syncNewMessages(), 2500);

    document.addEventListener("visibilitychange", refreshIfNeeded);
    window.addEventListener("focus", refreshIfNeeded);
    window.addEventListener("pageshow", refreshIfNeeded);

    return () => {
      document.removeEventListener("visibilitychange", refreshIfNeeded);
      window.removeEventListener("focus", refreshIfNeeded);
      window.removeEventListener("pageshow", refreshIfNeeded);
      window.clearInterval(deltaTimer);
      void supabase.removeChannel(channel);
    };
  }, [conversationId, load, markAsRead]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages.length]);

  async function submit(event: FormEvent) {
    event.preventDefault();

    const trimmed = content.trim();
    if (!trimmed || sending || !userId) return;

    const optimisticId = optimisticIdRef.current--;
    const optimisticMessage: Message = {
      id: optimisticId,
      sender_user_id: userId,
      sender_type: actorType,
      message_type: "text",
      content: trimmed,
      created_at: new Date().toISOString(),
    };

    setContent("");
    setError("");
    setSending(true);
    setMessages((current) => [...current, optimisticMessage]);

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

      const createdMessage = result.message as Message | undefined;

      if (createdMessage) {
        lastMessageIdRef.current = Math.max(
          lastMessageIdRef.current,
          Number(createdMessage.id) || 0,
        );

        setMessages((current) => {
          const withoutOptimistic = current.filter(
            (message) => message.id !== optimisticId,
          );

          return withoutOptimistic.some(
            (message) => message.id === createdMessage.id,
          )
            ? withoutOptimistic
            : [...withoutOptimistic, createdMessage];
        });
      } else {
        setMessages((current) =>
          current.filter((message) => message.id !== optimisticId),
        );
        void load(true);
      }
    } catch (sendError) {
      setMessages((current) =>
        current.filter((message) => message.id !== optimisticId),
      );
      setContent(trimmed);
      setError(
        sendError instanceof Error
          ? sendError.message
          : "메시지를 보내지 못했습니다.",
      );
    } finally {
      setSending(false);
    }
  }

  const hospital = useMemo(() => one(conversation?.hospitals ?? null), [conversation]);
  const pet = useMemo(() => one(conversation?.pets ?? null), [conversation]);
  const reservation = useMemo(() => one(conversation?.reservations ?? null), [conversation]);

  if (loading) return <main className="min-h-screen bg-slate-50 p-6 text-center text-slate-500">채팅을 불러오는 중입니다.</main>;

  return (
    <main
      className={`overflow-hidden bg-slate-100 text-slate-950 ${
        mode === "guardian"
          ? "h-[100dvh] pb-20"
          : "h-[calc(100dvh-6.5rem)] min-h-[620px]"
      }`}
    >
      <div
        className={`mx-auto grid h-full min-h-0 bg-white shadow-sm ${
          mode === "hospital"
            ? "max-w-[1800px] lg:grid-cols-[240px_minmax(0,1fr)_320px]"
            : "max-w-4xl"
        }`}
      >
        {mode === "hospital" && (
          <HospitalConversationSidebar
            activeConversationId={conversationId}
          />
        )}

        <div className="flex min-h-0 min-w-0 flex-col">
          <header className="shrink-0 border-b border-slate-200 bg-white px-4 py-3 sm:px-5">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <Link href={mode === "hospital" ? "/hospital-admin/chat" : "/chat"} className="text-sm font-bold text-slate-500">← 채팅 목록</Link>
                <h1 className="mt-1 truncate text-lg font-black">{mode === "hospital" ? `${reservation?.guardian_name ?? "보호자"} · ${pet?.name ?? "환자"}` : `${hospital?.name ?? "동물병원"} · ${pet?.name ?? "반려동물"}`}</h1>
                {reservation && <p className="mt-0.5 text-xs text-slate-500">예약 #{conversation?.reservation_id} · {reservation.reservation_date} {String(reservation.reservation_time).slice(0, 5)}</p>}
              </div>
              <div className="flex gap-2">
                {mode === "hospital" && <button type="button" onClick={() => setShowInfo(true)} className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-bold lg:hidden">환자정보</button>}
                {mode === "hospital" && conversation && <Link href={`/hospital-admin/reservations/${conversation.reservation_id}`} className="rounded-xl border border-slate-950 px-3 py-2 text-sm font-bold">예약 상세</Link>}
              </div>
            </div>
          </header>

          {error && <div className="border-b border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

          <section className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain bg-slate-50 p-4 sm:p-5">
            {messages.length === 0 && <div className="py-20 text-center text-sm text-slate-500">메시지를 보내 대화를 시작하세요.</div>}
            {messages.map((message) => {
              const isMine = message.sender_user_id === userId;
              if (message.message_type === "system") return <div key={message.id} className="mx-auto max-w-xl rounded-xl bg-slate-200 px-4 py-3 text-center text-sm leading-6 text-slate-700">{message.content}</div>;
              return <div key={message.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}><div className={`max-w-[82%] rounded-2xl px-4 py-3 ${isMine ? "bg-[#153f34] text-white" : "border border-slate-200 bg-white"}`}><p className="whitespace-pre-wrap break-words text-sm leading-6">{message.content}</p><p className={`mt-1 text-[10px] ${isMine ? "text-white/60" : "text-slate-400"}`}>{new Date(message.created_at).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}</p></div></div>;
            })}
            <div ref={endRef} />
          </section>

          <form onSubmit={submit} className="shrink-0 border-t border-slate-200 bg-white p-3">
            <div className="flex gap-2"><textarea value={content} onChange={(e) => setContent(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); e.currentTarget.form?.requestSubmit(); } }} rows={1} placeholder={actorType === "hospital" ? "보호자에게 전달할 내용을 입력하세요." : "병원에 문의할 내용을 입력하세요."} className="min-w-0 flex-1 resize-none rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-950"/><button type="submit" disabled={sending || !content.trim()} className="rounded-xl bg-slate-950 px-5 font-bold text-white disabled:bg-slate-400">{sending ? "전송 중" : "전송"}</button></div>
          </form>
        </div>

        {mode === "hospital" && <div className="hidden min-h-0 lg:block"><PatientContextPanel context={context} /></div>}
      </div>

      {showInfo && <div className="fixed inset-0 z-[100] bg-black/50 lg:hidden"><div className="absolute inset-y-0 right-0 w-[90%] max-w-md overflow-y-auto bg-white"><div className="sticky top-0 z-10 flex justify-end border-b bg-white p-3"><button type="button" onClick={() => setShowInfo(false)} className="rounded-xl border px-4 py-2 font-bold">닫기</button></div><PatientContextPanel context={context} /></div></div>}
      {mode === "guardian" && <GuardianBottomNav />}
    </main>
  );
}
