"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";

type Report = {
  id: number;
  reporter_user_id: string | null;
  category: string;
  subject: string;
  body: string;
  status: string;
  priority: string;
  created_at: string;
};

export default function AdminReportsPage() {
  const [items, setItems] = useState<Report[]>([]);

  async function load() {
    const { data } = await supabase
      .from("service_reports")
      .select("id, reporter_user_id, category, subject, body, status, priority, created_at")
      .order("created_at", { ascending: false });
    setItems((data ?? []) as Report[]);
  }

  useEffect(() => {
    void load();
  }, []);

  async function update(id: number, status: string) {
    await supabase.from("service_reports").update({ status, updated_at: new Date().toISOString() }).eq("id", id);
    void load();
  }

  return (
    <main className="min-h-screen bg-gray-50 px-5 py-8 text-black">
      <div className="mx-auto max-w-5xl">
        <Link href="/admin/operations" className="rounded-xl border bg-white px-4 py-2 text-sm">← 운영센터</Link>
        <h1 className="mt-8 text-3xl font-black">신고·문의 관리</h1>

        <div className="mt-6 space-y-4">
          {items.map((item) => (
            <article key={item.id} className="rounded-3xl border bg-white p-6">
              <div className="flex flex-wrap justify-between gap-3">
                <div>
                  <p className="text-xs font-bold text-gray-500">{item.category} · {item.priority}</p>
                  <h2 className="mt-2 text-xl font-black">{item.subject}</h2>
                </div>
                <span className="text-xs text-gray-500">{item.created_at.slice(0, 16).replace("T", " ")}</span>
              </div>
              <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-gray-700">{item.body}</p>
              <div className="mt-5 flex gap-2">
                <button onClick={() => void update(item.id, "reviewing")} className="rounded-xl border px-4 py-2 text-sm">검토 중</button>
                <button onClick={() => void update(item.id, "resolved")} className="rounded-xl bg-black px-4 py-2 text-sm text-white">처리 완료</button>
                <button onClick={() => void update(item.id, "closed")} className="rounded-xl border px-4 py-2 text-sm">종결</button>
              </div>
            </article>
          ))}
          {!items.length && <p className="rounded-3xl border bg-white p-8 text-center text-gray-500">접수된 신고나 문의가 없습니다.</p>}
        </div>
      </div>
    </main>
  );
}
