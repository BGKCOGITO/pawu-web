"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";

type Job = {
  id: string;
  status: string;
  attempts: number;
  max_attempts: number;
  last_error: string | null;
  created_at: string;
  sent_at: string | null;
};

type DashboardData = {
  activeTokens: number;
  total24h: number;
  counts: Record<string, number>;
  jobs: Job[];
};

export default function PushOperationsPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const api = useCallback(async (init?: RequestInit) => {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) throw new Error("로그인이 필요합니다.");
    const response = await fetch("/api/platform/push-operations", {
      ...init,
      headers: { "content-type": "application/json", authorization: `Bearer ${token}`, ...(init?.headers ?? {}) },
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message ?? "요청을 처리하지 못했습니다.");
    return result;
  }, []);

  const load = useCallback(async () => {
    try {
      setMessage("");
      const result = await api();
      setData(result.data);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  }, [api]);

  useEffect(() => { void load(); }, [load]);

  async function run(action: "recover" | "retry", jobId?: string) {
    try {
      setBusy(true);
      await api({ method: "POST", body: JSON.stringify({ action, jobId }) });
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-5 py-8 text-slate-950">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link href="/admin/operations" className="text-sm font-bold text-slate-600">← 운영센터</Link>
            <h1 className="mt-3 text-3xl font-black">푸시 발송 상태</h1>
            <p className="mt-2 text-sm text-slate-600">최근 24시간 큐, 활성 토큰, 실패 원인을 확인합니다.</p>
          </div>
          <button disabled={busy} onClick={() => void run("recover")} className="rounded-xl bg-slate-950 px-4 py-3 text-sm font-black text-white disabled:opacity-50">멈춘 작업 복구</button>
        </div>

        {message && <p className="mt-5 rounded-2xl bg-rose-50 p-4 text-sm font-bold text-rose-700">{message}</p>}

        {!data ? <p className="mt-8 text-slate-500">푸시 상태를 불러오는 중입니다.</p> : <>
          <section className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Metric label="활성 휴대폰" value={data.activeTokens} />
            <Metric label="24시간 작업" value={data.total24h} />
            <Metric label="발송 성공" value={data.counts.sent ?? 0} />
            <Metric label="확인 필요" value={(data.counts.retry ?? 0) + (data.counts.dead ?? 0) + (data.counts.processing ?? 0)} />
          </section>

          <section className="mt-6 overflow-hidden rounded-3xl border bg-white shadow-sm">
            <div className="border-b p-5"><h2 className="text-xl font-black">최근 작업</h2></div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="p-4">상태</th><th className="p-4">시도</th><th className="p-4">생성</th><th className="p-4">오류</th><th className="p-4">작업</th></tr></thead>
                <tbody>{data.jobs.map((job) => <tr key={job.id} className="border-t align-top"><td className="p-4 font-black">{job.status}</td><td className="p-4">{job.attempts}/{job.max_attempts}</td><td className="whitespace-nowrap p-4">{new Date(job.created_at).toLocaleString("ko-KR")}</td><td className="max-w-md break-words p-4 text-xs text-rose-700">{job.last_error ?? "-"}</td><td className="p-4">{["retry","dead","skipped","processing"].includes(job.status) && <button disabled={busy} onClick={() => void run("retry", job.id)} className="rounded-lg border px-3 py-2 text-xs font-black disabled:opacity-50">재시도</button>}</td></tr>)}</tbody>
              </table>
            </div>
          </section>
        </>}
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return <article className="rounded-3xl border bg-white p-5 shadow-sm"><p className="text-sm font-bold text-slate-500">{label}</p><strong className="mt-2 block text-3xl">{value.toLocaleString("ko-KR")}</strong></article>;
}
