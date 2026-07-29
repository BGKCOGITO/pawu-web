"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

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

  useEffect(() => {
    async function load() {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from("chat_conversations")
        .select("id, reservation_id, status, last_message_at, last_message_preview, hospitals(name), pets(name)")
        .eq("guardian_user_id", auth.user.id)
        .order("last_message_at", { ascending: false });

      setItems((data ?? []) as unknown as Conversation[]);
      setLoading(false);
    }

    void load();
  }, []);

  return (
    <main className="min-h-screen bg-gray-50 px-5 py-8 text-black">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center justify-between">
          <Link href="/" className="rounded-xl border bg-white px-4 py-2 text-sm">← 홈</Link>
          <Link href="/ai-care" className="rounded-xl bg-black px-4 py-2 text-sm text-white">AI 증상 안내</Link>
        </div>

        <header className="mt-8">
          <p className="text-sm text-gray-500">PAWU Communication</p>
          <h1 className="mt-2 text-3xl font-black">병원 채팅</h1>
          <p className="mt-2 text-sm text-gray-600">승인된 예약과 연결된 병원 상담방입니다.</p>
        </header>

        {loading ? (
          <p className="mt-8 text-gray-500">채팅 목록을 불러오는 중입니다.</p>
        ) : items.length === 0 ? (
          <section className="mt-8 rounded-3xl border bg-white p-8 text-center">
            <p className="text-gray-500">아직 시작된 채팅이 없습니다.</p>
            <Link href="/my-reservations" className="mt-5 inline-block rounded-xl bg-black px-4 py-3 text-sm text-white">내 예약 확인</Link>
          </section>
        ) : (
          <div className="mt-8 space-y-3">
            {items.map((item) => (
              <Link key={item.id} href={`/chat/${item.id}`} className="block rounded-3xl border bg-white p-5 transition hover:border-black">
                <div className="flex items-center justify-between gap-3">
                  <strong>{one(item.hospitals)?.name ?? "동물병원"}</strong>
                  <span className="text-xs text-gray-500">{item.last_message_at?.slice(0, 10) ?? ""}</span>
                </div>
                <p className="mt-2 text-sm text-gray-600">{one(item.pets)?.name ?? "반려동물"}</p>
                <p className="mt-3 line-clamp-1 text-sm text-gray-500">{item.last_message_preview ?? "채팅을 시작해 보세요."}</p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
