"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

type Notification = {
  id: number;
  type: string;
  title: string;
  body: string;
  link_url: string | null;
  read_at: string | null;
  created_at: string;
};

export default function NotificationsPage() {
  const [items, setItems] = useState<Notification[]>([]);
  const [message, setMessage] = useState("");

  async function token() {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? "";
  }

  async function load() {
    const accessToken = await token();
    if (!accessToken) return;
    const response = await fetch("/api/notifications", {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    const result = await response.json();
    if (!response.ok) {
      setMessage(result.message ?? "알림을 불러오지 못했습니다.");
      return;
    }
    setItems(result.notifications ?? []);
  }

  useEffect(() => {
    void load();
  }, []);

  async function markRead(notificationId?: number) {
    const accessToken = await token();
    if (!accessToken) return;
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(notificationId ? { notificationId } : { markAll: true }),
    });
    void load();
  }

  return (
    <main className="min-h-screen bg-gray-50 px-5 py-8 text-black">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center justify-between gap-3">
          <Link href="/platform" className="rounded-xl border bg-white px-4 py-2 text-sm">← 보호자 홈</Link>
          <div className="flex gap-2">
            <Link href="/notifications/settings" className="rounded-xl border bg-white px-4 py-2 text-sm">설정</Link>
            <button onClick={() => void markRead()} className="rounded-xl bg-black px-4 py-2 text-sm text-white">모두 읽음</button>
          </div>
        </div>

        <h1 className="mt-8 text-3xl font-black">알림센터</h1>
        {message && <p className="mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-700">{message}</p>}

        <div className="mt-6 space-y-3">
          {items.map((item) => {
            const content = (
              <article className={`rounded-3xl border p-5 ${item.read_at ? "bg-white" : "bg-blue-50 border-blue-200"}`}>
                <div className="flex justify-between gap-3">
                  <strong>{item.title}</strong>
                  <span className="text-xs text-gray-500">{item.created_at.slice(0, 16).replace("T", " ")}</span>
                </div>
                <p className="mt-3 text-sm leading-6 text-gray-600">{item.body}</p>
              </article>
            );

            return item.link_url ? (
              <Link key={item.id} href={item.link_url} onClick={() => void markRead(item.id)}>{content}</Link>
            ) : (
              <button key={item.id} onClick={() => void markRead(item.id)} className="block w-full text-left">{content}</button>
            );
          })}
          {!items.length && <div className="rounded-3xl border bg-white p-8 text-center text-gray-500">새 알림이 없습니다.</div>}
        </div>
      </div>
    </main>
  );
}
