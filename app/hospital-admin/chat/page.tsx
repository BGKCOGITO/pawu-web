"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { hospitalAuthFetch } from "@/lib/hospital-auth-fetch";
import { supabase } from "@/lib/supabase";

type Conversation = {
  id: number;
  reservation_id: number;
  status: string;
  last_message_at: string | null;
  last_message_preview: string | null;
  unread_count: number;
  pet: { name: string; species: string | null; breed: string | null } | null;
  reservation: {
    guardian_name: string | null;
    phone: string | null;
    reservation_date: string | null;
    reservation_time: string | null;
    status: string | null;
  } | null;
};

export default function HospitalChatListPage() {
  const [items, setItems] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const response = await hospitalAuthFetch("/api/hospital/chat/conversations", { cache: "no-store" });
        const result = await response.json();
        if (!response.ok) throw new Error(result.message ?? "채팅 목록을 불러오지 못했습니다.");
        if (active) setItems((result.conversations ?? []) as Conversation[]);
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : "채팅 목록을 불러오지 못했습니다.");
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();

    const channel = supabase
      .channel("hospital-chat-list-live")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages" },
        () => {
          if (active) void load();
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "chat_conversations" },
        () => {
          if (active) void load();
        },
      )
      .subscribe();

    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 3000);

    const handleVisibility = () => {
      if (document.visibilityState === "visible") void load();
    };
    window.addEventListener("focus", handleVisibility);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener("focus", handleVisibility);
      document.removeEventListener("visibilitychange", handleVisibility);
      void supabase.removeChannel(channel);
    };
  }, []);

  return (
    <main className="min-h-screen bg-[#f4f7fb] px-6 py-8 text-black">
      <div className="mx-auto max-w-5xl">
        <Link href="/hospital-admin" className="inline-flex rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold">← 병원관리자</Link>

        <header className="mt-8">
          <p className="text-sm font-bold text-slate-500">PAWU Communication</p>
          <div className="mt-2 flex items-end justify-between gap-4">
            <h1 className="text-3xl font-black">보호자 채팅</h1>
            <span className="rounded-full bg-slate-900 px-4 py-2 text-sm font-bold text-white">전체 {items.length}건</span>
          </div>
        </header>

        {error && <p className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p>}

        {loading ? (
          <p className="mt-8 text-slate-500">채팅 목록을 불러오는 중입니다.</p>
        ) : items.length === 0 ? (
          <section className="mt-8 rounded-3xl border border-slate-300 bg-white p-10 text-center text-slate-500">
            열린 보호자 채팅이 없습니다.
          </section>
        ) : (
          <div className="mt-8 grid gap-4 lg:grid-cols-2">
            {items.map((item) => (
              <Link
                href={`/hospital-admin/chat/${item.id}`}
                key={item.id}
                className="relative block rounded-3xl border border-slate-300 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-700"
              >
                {item.unread_count > 0 && (
                  <strong className="absolute right-5 top-5 min-w-7 rounded-full bg-red-500 px-2 py-1 text-center text-xs text-white">
                    {item.unread_count > 99 ? "99+" : item.unread_count}
                  </strong>
                )}
                <div className="pr-12">
                  <p className="text-xs font-bold text-slate-400">예약 #{item.reservation_id}</p>
                  <h2 className="mt-2 text-xl font-black">{item.reservation?.guardian_name ?? "보호자"} · {item.pet?.name ?? "환자"}</h2>
                  <p className="mt-2 text-sm text-slate-500">
                    {item.pet?.species ?? "반려동물"}{item.pet?.breed ? ` · ${item.pet.breed}` : ""}
                  </p>
                  <p className="mt-1 text-sm font-bold text-slate-700">
                    {item.reservation?.reservation_date ?? "-"} {String(item.reservation?.reservation_time ?? "").slice(0, 5)}
                  </p>
                </div>
                <p className="mt-5 line-clamp-2 rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">
                  {item.last_message_preview ?? "새 채팅"}
                </p>
                <div className="mt-4 flex items-center justify-between text-xs text-slate-400">
                  <span>{item.status === "open" ? "대화 중" : item.status}</span>
                  <span>{item.last_message_at ? new Date(item.last_message_at).toLocaleString("ko-KR") : ""}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
