"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabase";

const labels: Record<string, string> = {
  ordered: "검사 지시",
  collected: "검체 채취",
  processing: "검사 중",
  completed: "결과 입력",
  finalized: "확정",
  cancelled: "취소",
};

export default function LabOrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [status, setStatus] = useState("all");
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return;

    const response = await fetch("/api/hospital/lab/orders", {
      headers: { authorization: `Bearer ${token}` },
    });
    const result = await response.json();

    if (!response.ok) {
      setMessage(result.message ?? "검사 목록을 불러오지 못했습니다.");
      return;
    }

    setOrders(result.orders ?? []);
  }

  useEffect(() => {
    void load();
  }, []);

  const visible = useMemo(
    () =>
      orders.filter((order) => {
        const pet = Array.isArray(order.pets) ? order.pets[0] : order.pets;
        return (
          (status === "all" || order.status === status) &&
          `${pet?.name ?? ""} ${order.test_name}`.toLowerCase().includes(query.toLowerCase())
        );
      }),
    [orders, status, query],
  );

  return (
    <main className="min-h-screen bg-slate-50 px-5 py-8 text-black">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap justify-between gap-3">
          <Link href="/hospital-admin/v6-4" className="rounded-xl border bg-white px-4 py-2 text-sm">← V6.4 대시보드</Link>
          <Link href="/hospital-admin/lab/new" className="rounded-xl bg-black px-4 py-2 text-sm font-bold text-white">새 검사 지시</Link>
        </div>

        <header className="mt-8">
          <p className="text-sm text-gray-500">검사·영상 결과 관리</p>
          <h1 className="mt-2 text-3xl font-black">검사 주문 목록</h1>
        </header>

        {message && <p className="mt-5 rounded-2xl bg-white p-4 text-sm">{message}</p>}

        <section className="mt-6 rounded-3xl border bg-white p-5">
          <div className="flex flex-wrap gap-3">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="환자명 또는 검사명"
              className="min-w-[220px] flex-1 rounded-xl border p-3"
            />
            <select value={status} onChange={(event) => setStatus(event.target.value)} className="rounded-xl border p-3">
              <option value="all">전체 상태</option>
              {Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </div>

          <div className="mt-5 space-y-3">
            {visible.map((order) => {
              const pet = Array.isArray(order.pets) ? order.pets[0] : order.pets;
              return (
                <Link
                  key={order.id}
                  href={`/hospital-admin/lab/${order.id}`}
                  className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border p-5 hover:border-black"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-black">{pet?.name ?? "환자"}</h2>
                      <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-bold">
                        {labels[order.status] ?? order.status}
                      </span>
                      {order.priority !== "routine" && (
                        <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-700">
                          {order.priority}
                        </span>
                      )}
                    </div>
                    <p className="mt-2 text-sm">{order.category} · {order.test_name}</p>
                    <p className="mt-1 text-xs text-gray-500">
                      {new Date(order.created_at).toLocaleString("ko-KR")}
                    </p>
                  </div>
                  <p className="font-bold">검사 열기 →</p>
                </Link>
              );
            })}

            {!visible.length && (
              <p className="rounded-2xl bg-gray-50 p-10 text-center text-sm text-gray-500">
                조건에 맞는 검사 주문이 없습니다.
              </p>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
