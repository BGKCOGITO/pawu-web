"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";

type Data = {
  hospitals: number;
  pendingVerifications: number;
  users: number;
  pets: number;
  monthReservations: number;
  monthCompleted: number;
  openChats: number;
  openReports: number;
  recentAuditLogs: Array<{ id: number; action: string; entity_type: string; created_at: string }>;
};

export default function AdminOperationsPage() {
  const [data, setData] = useState<Data | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function load() {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      if (!token) return;
      const response = await fetch("/api/platform/admin-overview", {
        headers: { authorization: `Bearer ${token}` },
      });
      const result = await response.json();
      if (!response.ok) {
        setMessage(result.message ?? "운영센터를 불러오지 못했습니다.");
        return;
      }
      setData(result.data);
    }
    void load();
  }, []);

  if (!data) {
    return <main className="min-h-screen bg-gray-50 p-8 text-center text-gray-600">{message || "관리자 운영센터를 준비하는 중입니다."}</main>;
  }

  return (
    <main className="min-h-screen bg-slate-50 px-5 py-8 text-black">
      <div className="mx-auto max-w-6xl">
        <Link href="/admin" className="rounded-xl border bg-white px-4 py-2 text-sm">← 기존 관리자</Link>

        <header className="mt-8 rounded-[2rem] bg-black p-8 text-white">
          <p className="text-sm text-gray-300">PAWU Master Operations</p>
          <h1 className="mt-2 text-3xl font-black">관리자 운영센터</h1>
          <p className="mt-3 text-sm text-gray-300">병원, 사용자, 예약, 채팅, 신고와 운영 기록을 확인합니다.</p>
        </header>

        <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Metric title="등록 병원" value={data.hospitals} />
          <Metric title="병원 검증 대기" value={data.pendingVerifications} />
          <Metric title="전체 사용자" value={data.users} />
          <Metric title="등록 반려동물" value={data.pets} />
          <Metric title="이번 달 예약" value={data.monthReservations} />
          <Metric title="이번 달 완료" value={data.monthCompleted} />
          <Metric title="열린 채팅방" value={data.openChats} />
          <Metric title="처리 필요 신고" value={data.openReports} />
        </section>

        <section className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Menu href="/admin/hospital-verification" title="병원 검증" />
          <Menu href="/admin/reports" title="신고·문의" />
          <Menu href="/admin/audit-logs" title="전체 활동 기록" />
          <Menu href="/admin/system-status" title="시스템 상태" />
          <Menu href="/admin/push-operations" title="푸시 발송 상태" />
          <Menu href="/policies" title="정책 페이지" />
        </section>

        <section className="mt-6 rounded-3xl border bg-white p-6">
          <h2 className="text-xl font-black">최근 운영 기록</h2>
          <div className="mt-5 space-y-3">
            {data.recentAuditLogs.map((log) => (
              <article key={log.id} className="flex justify-between gap-4 rounded-2xl bg-gray-50 p-4">
                <div>
                  <strong>{log.action}</strong>
                  <p className="mt-1 text-xs text-gray-500">{log.entity_type}</p>
                </div>
                <span className="text-xs text-gray-500">{log.created_at.slice(0, 16).replace("T", " ")}</span>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

function Metric({ title, value }: { title: string; value: number }) {
  return <article className="rounded-3xl border bg-white p-5"><p className="text-sm text-gray-500">{title}</p><p className="mt-2 text-3xl font-black">{value.toLocaleString()}</p></article>;
}

function Menu({ href, title }: { href: string; title: string }) {
  return <Link href={href} className="rounded-3xl border bg-white p-5 font-black transition hover:border-black">{title}</Link>;
}
