"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";

type Analytics = {
  thisMonth: {
    totalReservations: number;
    activeReservations: number;
    completedReservations: number;
    cancellationRate: number;
    repeatGuardianRate: number;
    uniquePatientsEstimate: number;
    openChats: number;
  };
  monthly: Array<{ month: string; total: number; completed: number; cancelled: number }>;
};

export default function HospitalAnalyticsPage() {
  const [data, setData] = useState<Analytics | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function load() {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      if (!token) return;

      const response = await fetch("/api/platform/hospital-analytics", {
        headers: { authorization: `Bearer ${token}` },
      });
      const result = await response.json();
      if (!response.ok) {
        setMessage(result.message ?? "통계를 불러오지 못했습니다.");
        return;
      }
      setData(result.data);
    }
    void load();
  }, []);

  if (!data) {
    return <main className="min-h-screen bg-gray-50 p-8 text-center text-gray-600">{message || "병원 통계를 준비하는 중입니다."}</main>;
  }

  const maxValue = Math.max(...data.monthly.map((item) => item.total), 1);

  return (
    <main className="min-h-screen bg-slate-50 px-5 py-8 text-black">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap justify-between gap-3">
          <Link href="/hospital-admin/v4" className="rounded-xl border bg-white px-4 py-2 text-sm">← V4 대시보드</Link>
          <span className="rounded-xl bg-white px-4 py-2 text-sm">현재 월 기준</span>
        </div>

        <h1 className="mt-8 text-3xl font-black">병원 운영 통계</h1>
        <p className="mt-2 text-sm text-gray-600">현재 예약 데이터 기반의 초기 운영 지표입니다. 매출은 결제 시스템 연결 후 추가됩니다.</p>

        <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Metric title="이번 달 예약" value={`${data.thisMonth.totalReservations}건`} />
          <Metric title="완료 진료" value={`${data.thisMonth.completedReservations}건`} />
          <Metric title="취소·거절률" value={`${data.thisMonth.cancellationRate}%`} />
          <Metric title="재방문 보호자 비율" value={`${data.thisMonth.repeatGuardianRate}%`} />
          <Metric title="누적 환자 연결" value={`${data.thisMonth.uniquePatientsEstimate}건`} />
          <Metric title="열린 채팅방" value={`${data.thisMonth.openChats}개`} />
        </section>

        <section className="mt-6 rounded-3xl border bg-white p-6">
          <h2 className="text-xl font-black">최근 6개월 예약 흐름</h2>
          <div className="mt-6 flex h-72 items-end gap-3 overflow-x-auto border-b px-3 pb-3">
            {data.monthly.map((item) => (
              <div key={item.month} className="flex min-w-24 flex-1 flex-col items-center justify-end">
                <div className="flex h-52 w-full items-end justify-center">
                  <div
                    className="w-12 rounded-t-xl bg-black"
                    style={{ height: `${Math.max((item.total / maxValue) * 100, item.total ? 8 : 1)}%` }}
                    title={`${item.total}건`}
                  />
                </div>
                <p className="mt-3 text-xs font-bold">{item.month.slice(5)}월</p>
                <p className="mt-1 text-[11px] text-gray-500">{item.total}건 · 완료 {item.completed}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

function Metric({ title, value }: { title: string; value: string }) {
  return (
    <article className="rounded-3xl border bg-white p-5">
      <p className="text-sm text-gray-500">{title}</p>
      <p className="mt-2 text-2xl font-black">{value}</p>
    </article>
  );
}
