"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import GuardianBottomNav from "@/components/GuardianBottomNav";

type Conversation = {
  id: number;
  reservation_id: number;
  status: string;
  last_message_at: string | null;
  last_message_preview: string | null;
  hospitals: { name: string } | { name: string }[] | null;
  pets: { name: string } | { name: string }[] | null;
};

function one<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

export default function GuardianChatListPage() {
  const [items, setItems] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) {
        setLoading(false);
        setError("로그인이 필요합니다.");
        return;
      }

      const response = await fetch("/api/chat/conversations", {
        headers: { authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const result = await response.json();
      if (!response.ok) setError(result.message ?? "채팅 목록을 불러오지 못했습니다.");
      else setItems((result.conversations ?? []) as Conversation[]);
      setLoading(false);
    }
    void load();
  }, []);

  return (
    <main className="min-h-screen bg-[#f7f5ef] px-5 pb-36 pt-8 text-black">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center justify-between">
          <Link href="/" className="rounded-xl border border-[#d9ddd7] bg-white px-4 py-2 text-sm font-bold">← 홈</Link>
          <Link href="/my-reservations" className="rounded-xl bg-[#153f34] px-4 py-2 text-sm font-bold text-white">내 예약</Link>
        </div>

        <header className="mt-8">
          <p className="text-sm font-black tracking-[0.14em] text-[#d86c57]">PAWU COMMUNICATION</p>
          <h1 className="mt-2 text-3xl font-black text-[#153f34]">병원 채팅</h1>
          <p className="mt-2 text-sm leading-6 text-gray-600">병원에서 예약 조율이나 안내 메시지를 보내면 이곳에서 바로 확인하고 답장할 수 있습니다.</p>
        </header>

        {error && <p className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p>}

        {loading ? (
          <p className="mt-8 text-gray-500">채팅 목록을 불러오는 중입니다.</p>
        ) : items.length === 0 ? (
          <section className="mt-8 rounded-[28px] border border-[#e1e3de] bg-white p-8 text-center shadow-sm">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#eef5f1] text-2xl">💬</div>
            <h2 className="mt-5 text-xl font-black text-[#153f34]">아직 시작된 채팅이 없습니다</h2>
            <p className="mt-2 text-sm leading-6 text-gray-500">병원이 예약 확인 과정에서 채팅을 시작하면 이 화면과 하단 채팅 버튼에 새 메시지가 표시됩니다.</p>
          </section>
        ) : (
          <div className="mt-8 space-y-3">
            {items.map((item) => (
              <Link key={item.id} href={`/chat/${item.id}`} className="block rounded-[24px] border border-[#e1e3de] bg-white p-5 shadow-sm transition active:scale-[.99]">
                <div className="flex items-center justify-between gap-3">
                  <strong className="text-lg text-[#153f34]">{one(item.hospitals)?.name ?? "동물병원"}</strong>
                  <span className="text-xs text-gray-400">{item.last_message_at ? new Date(item.last_message_at).toLocaleDateString("ko-KR") : ""}</span>
                </div>
                <p className="mt-1 text-sm font-bold text-gray-600">{one(item.pets)?.name ?? "반려동물"} · 예약 #{item.reservation_id}</p>
                <p className="mt-3 line-clamp-2 rounded-xl bg-[#f7f5ef] p-3 text-sm leading-6 text-gray-600">{item.last_message_preview ?? "병원과 대화를 시작해 보세요."}</p>
              </Link>
            ))}
          </div>
        )}
      </div>
      <GuardianBottomNav />
    </main>
  );
}
