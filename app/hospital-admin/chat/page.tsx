"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";

type Conversation = {
  id: number;
  status: string;
  last_message_at: string | null;
  last_message_preview: string | null;
  pets: { name: string } | { name: string }[] | null;
  reservations: { guardian_name: string } | { guardian_name: string }[] | null;
};

function one<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

export default function HospitalChatListPage() {
  const [items, setItems] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        setLoading(false);
        return;
      }

      let hospitalId: number | null = null;

      const { data: staff } = await supabase
        .from("hospital_staff")
        .select("hospital_id")
        .eq("user_id", auth.user.id)
        .eq("is_active", true)
        .maybeSingle();

      if (staff) hospitalId = Number(staff.hospital_id);

      if (!hospitalId) {
        const { data: admin } = await supabase
          .from("hospital_admins")
          .select("hospital_id")
          .eq("user_id", auth.user.id)
          .maybeSingle();
        if (admin) hospitalId = Number(admin.hospital_id);
      }

      if (!hospitalId) {
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from("chat_conversations")
        .select("id, status, last_message_at, last_message_preview, pets(name), reservations(guardian_name)")
        .eq("hospital_id", hospitalId)
        .order("last_message_at", { ascending: false });

      setItems((data ?? []) as unknown as Conversation[]);
      setLoading(false);
    }

    void load();
  }, []);

  return (
    <main className="min-h-screen bg-gray-50 px-5 py-8 text-black">
      <div className="mx-auto max-w-4xl">
        <Link href="/hospital-admin" className="rounded-xl border bg-white px-4 py-2 text-sm">← 병원관리자</Link>

        <header className="mt-8">
          <p className="text-sm text-gray-500">PAWU Communication</p>
          <h1 className="mt-2 text-3xl font-black">보호자 채팅</h1>
        </header>

        {loading ? (
          <p className="mt-8">불러오는 중...</p>
        ) : items.length === 0 ? (
          <section className="mt-8 rounded-3xl border bg-white p-8 text-center text-gray-500">열린 보호자 채팅이 없습니다.</section>
        ) : (
          <div className="mt-8 space-y-3">
            {items.map((item) => (
              <Link href={`/hospital-admin/chat/${item.id}`} key={item.id} className="block rounded-3xl border bg-white p-5 hover:border-black">
                <div className="flex justify-between gap-3">
                  <strong>{one(item.pets)?.name ?? "환자"}</strong>
                  <span className="text-xs text-gray-500">{item.last_message_at?.slice(0, 16).replace("T", " ") ?? ""}</span>
                </div>
                <p className="mt-2 text-sm text-gray-600">{one(item.reservations)?.guardian_name ?? "보호자"}</p>
                <p className="mt-3 line-clamp-1 text-sm text-gray-500">{item.last_message_preview ?? "새 채팅"}</p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
