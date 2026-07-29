"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type DashboardData = {
  today: string;
  metrics: Record<string, number>;
  todayRows: Array<{ id: number; status: string; reservation_time: string | null; pet_name: string | null; guardian_name: string | null; visit_reason: string | null }>;
  monthly: Array<{ month: string; total: number; completed: number; cancelled: number; revenue: number }>;
  topReasons: Array<{ label: string; count: number }>;
  topMedications: Array<{ label: string; count: number }>;
  activeInpatients: Array<{ id: number; pet_name: string | null; guardian_name: string | null; status: string; expected_discharge_at: string | null; risk_level: string | null }>;
  recentReviews: Array<{ id: number; content: string; hospital_reply: string | null; created_at: string; visit_date: string; pets: { name?: string | null } | Array<{ name?: string | null }> | null }>;
  insights: string[];
  warnings: string[];
};

const STATUS_LABEL: Record<string, string> = {
  requested: "승인 대기",
  approved: "예약 확정",
  completed: "진료 완료",
  cancelled: "취소",
  rejected: "거절",
  no_show: "미방문",
};

export default function HospitalDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  async function load() {
    setLoading(true);
    setMessage("");
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) {
      setMessage("로그인이 필요합니다.");
      setLoading(false);
      return;
    }
    const response = await fetch("/api/hospital/dashboard/v12", {
      headers: { authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    const result = await response.json().catch(() => null);
    if (!response.ok || !result?.ok) {
      setMessage(result?.message ?? "운영 현황을 불러오지 못했습니다.");
      setLoading(false);
      return;
    }
    setData(result.data);
    setLoading(false);
  }

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const metrics = data?.metrics ?? {};
  const maxMonthly = useMemo(() => Math.max(1, ...(data?.monthly ?? []).map((item) => item.total)), [data]);
  const maxReason = useMemo(() => Math.max(1, ...(data?.topReasons ?? []).map((item) => item.count)), [data]);
  const maxMedication = useMemo(() => Math.max(1, ...(data?.topMedications ?? []).map((item) => item.count)), [data]);

  return (
    <main className="min-h-screen bg-slate-100 p-4 lg:p-6">
      <div className="mx-auto max-w-[1500px] space-y-5">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-indigo-600">PAWU V12.0</p>
            <h1 className="mt-1 text-2xl font-black text-slate-950">병원 운영 대시보드</h1>
            <p className="mt-1 text-sm text-slate-500">예약·진료·입원·보호자·후기 데이터를 한 화면에서 확인합니다.</p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => void load()} className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700">새로고침</button>
            <Link href="/hospital-admin/workflow-v6-2" className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-bold text-white">오늘 업무 보기</Link>
          </div>
        </header>

        {message && <div className="rounded-2xl border border-red-300 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{message}</div>}
        {(data?.warnings?.length ?? 0) > 0 && <div className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-xs text-amber-800">일부 선택 통계가 준비되지 않았습니다. 나머지 지표는 정상적으로 표시됩니다.</div>}

        <section className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
          <MetricCard label="오늘 예약" value={metrics.todayReservations} suffix="건" href="/hospital-admin/reservations" />
          <MetricCard label="진료 완료" value={metrics.todayCompleted} suffix="건" href="/hospital-admin/emr" />
          <MetricCard label="승인 대기" value={metrics.requestedReservations} suffix="건" href="/hospital-admin/reservations" alert />
          <MetricCard label="현재 입원" value={metrics.activeInpatients} suffix="마리" href="/hospital-admin/inpatients" />
          <MetricCard label="오늘 퇴원 예정" value={metrics.dischargeToday} suffix="마리" href="/hospital-admin/inpatients" />
          <MetricCard label="후기 답글 대기" value={metrics.pendingReviews} suffix="건" href="/hospital-admin/reviews" alert />
        </section>

        <section className="grid gap-5 xl:grid-cols-[1.55fr_1fr]">
          <article className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div><h2 className="font-black text-slate-950">오늘 예약 일정</h2><p className="text-xs text-slate-500">{data?.today ?? "-"} · 시간순</p></div>
              <Link href="/hospital-admin/reservations" className="text-sm font-bold text-indigo-700">전체 보기</Link>
            </div>
            <div className="divide-y divide-slate-100">
              {(data?.todayRows ?? []).map((row) => (
                <Link key={row.id} href={`/hospital-admin/reservations/${row.id}`} className="grid grid-cols-[64px_1fr_auto] gap-3 px-5 py-4 transition hover:bg-slate-50">
                  <div className="text-base font-black text-slate-950">{row.reservation_time?.slice(0, 5) ?? "-"}</div>
                  <div className="min-w-0"><p className="truncate font-bold text-slate-900">{row.pet_name ?? "이름 미입력"} <span className="font-medium text-slate-400">· {row.guardian_name ?? "보호자 미입력"}</span></p><p className="mt-1 truncate text-xs text-slate-500">{row.visit_reason ?? "방문 사유 없음"}</p></div>
                  <span className="self-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-bold text-slate-700">{STATUS_LABEL[row.status] ?? row.status}</span>
                </Link>
              ))}
              {!loading && (data?.todayRows?.length ?? 0) === 0 && <p className="px-5 py-12 text-center text-sm text-slate-500">오늘 등록된 예약이 없습니다.</p>}
            </div>
          </article>

          <article className="rounded-3xl bg-slate-950 p-5 text-white shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-indigo-300">운영 요약</p>
            <h2 className="mt-1 text-xl font-black">오늘 확인할 내용</h2>
            <div className="mt-5 space-y-3">
              {(data?.insights ?? []).map((item, index) => <div key={`${item}-${index}`} className="rounded-2xl bg-white/10 px-4 py-3 text-sm leading-6 text-slate-100">{item}</div>)}
            </div>
          </article>
        </section>

        <section className="grid gap-5 xl:grid-cols-[1.2fr_1fr_1fr]">
          <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between"><div><h2 className="font-black">최근 6개월 예약 추이</h2><p className="text-xs text-slate-500">예약·완료·취소 현황</p></div><Link href="/hospital-admin/analytics" className="text-sm font-bold text-indigo-700">상세 통계</Link></div>
            <div className="mt-6 flex h-52 items-end gap-3">
              {(data?.monthly ?? []).map((item) => <div key={item.month} className="flex min-w-0 flex-1 flex-col items-center gap-2"><div className="flex h-40 w-full items-end rounded-t-lg bg-slate-100"><div className="w-full rounded-t-lg bg-indigo-600" style={{ height: `${Math.max(5, (item.total / maxMonthly) * 100)}%` }} title={`예약 ${item.total}건`} /></div><span className="text-[10px] text-slate-500">{item.month.slice(5)}월</span></div>)}
            </div>
          </article>

          <SummaryCard title="이번 달 운영 지표" rows={[
            ["전체 예약", `${metrics.monthReservations ?? 0}건`],
            ["진료 완료", `${metrics.monthCompleted ?? 0}건`],
            ["취소·미방문", `${metrics.monthCancelled ?? 0}건`],
            ["예약 취소율", `${metrics.cancellationRate ?? 0}%`],
            ["재방문율", `${metrics.repeatRate ?? 0}%`],
            ["보호자 수", `${metrics.uniqueGuardians ?? 0}명`],
          ]} />

          <SummaryCard title="이번 달 수납" rows={[
            ["수납 금액", `${Number(metrics.monthRevenue ?? 0).toLocaleString("ko-KR")}원`],
            ["답글 대기 후기", `${metrics.pendingReviews ?? 0}건`],
            ["현재 입원", `${metrics.activeInpatients ?? 0}마리`],
            ["오늘 퇴원 예정", `${metrics.dischargeToday ?? 0}마리`],
          ]} />
        </section>

        <section className="grid gap-5 lg:grid-cols-2">
          <RankCard title="많이 기록된 방문 사유" items={data?.topReasons ?? []} max={maxReason} empty="이번 달 완료 진료 기록이 없습니다." />
          <RankCard title="많이 처방한 약" items={data?.topMedications ?? []} max={maxMedication} empty="이번 달 처방 기록이 없습니다." />
        </section>

        <section className="grid gap-5 lg:grid-cols-2">
          <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between"><h2 className="font-black">현재 입원 현황</h2><Link href="/hospital-admin/inpatients" className="text-sm font-bold text-indigo-700">입원 관리</Link></div>
            <div className="mt-3 divide-y divide-slate-100">
              {(data?.activeInpatients ?? []).map((row) => <div key={row.id} className="flex items-center justify-between gap-3 py-3"><div><p className="font-bold">{row.pet_name ?? "환자 이름 미입력"}</p><p className="text-xs text-slate-500">{row.guardian_name ?? "보호자 미입력"}</p></div><div className="text-right"><p className="text-xs font-bold text-slate-700">{row.status}</p><p className="text-[11px] text-slate-400">퇴원 예정 {row.expected_discharge_at?.slice(0, 10) ?? "미정"}</p></div></div>)}
              {!loading && (data?.activeInpatients?.length ?? 0) === 0 && <p className="py-8 text-center text-sm text-slate-500">현재 입원 중인 환자가 없습니다.</p>}
            </div>
          </article>

          <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between"><h2 className="font-black">최근 방문 후기</h2><Link href="/hospital-admin/reviews" className="text-sm font-bold text-indigo-700">후기 관리</Link></div>
            <div className="mt-3 divide-y divide-slate-100">
              {(data?.recentReviews ?? []).map((review) => {
                const pet = Array.isArray(review.pets) ? review.pets[0]?.name : review.pets?.name;
                return <div key={review.id} className="py-3"><div className="flex items-center justify-between gap-3"><p className="text-sm font-bold">{pet ?? "방문 환자"}</p><span className="text-[11px] text-slate-400">{review.visit_date}</span></div><p className="mt-1 line-clamp-2 text-sm leading-6 text-slate-600">{review.content}</p><p className={`mt-2 text-xs font-bold ${review.hospital_reply ? "text-emerald-600" : "text-amber-600"}`}>{review.hospital_reply ? "답글 작성 완료" : "답글 작성 필요"}</p></div>;
              })}
              {!loading && (data?.recentReviews?.length ?? 0) === 0 && <p className="py-8 text-center text-sm text-slate-500">등록된 방문 후기가 없습니다.</p>}
            </div>
          </article>
        </section>
      </div>
    </main>
  );
}

function MetricCard({ label, value = 0, suffix, href, alert }: { label: string; value?: number; suffix: string; href: string; alert?: boolean }) {
  return <Link href={href} className={`rounded-2xl border bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${alert ? "border-amber-300" : "border-slate-200"}`}><p className="text-xs font-bold text-slate-500">{label}</p><p className="mt-2 text-2xl font-black text-slate-950">{value}<span className="ml-1 text-xs font-semibold text-slate-500">{suffix}</span></p></Link>;
}

function SummaryCard({ title, rows }: { title: string; rows: Array<[string, string]> }) {
  return <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="font-black">{title}</h2><div className="mt-4 divide-y divide-slate-100">{rows.map(([label, value]) => <div key={label} className="flex items-center justify-between py-3 text-sm"><span className="text-slate-500">{label}</span><strong className="text-slate-950">{value}</strong></div>)}</div></article>;
}

function RankCard({ title, items, max, empty }: { title: string; items: Array<{ label: string; count: number }>; max: number; empty: string }) {
  return <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="font-black">{title}</h2><div className="mt-4 space-y-4">{items.map((item) => <div key={item.label}><div className="flex items-center justify-between text-sm"><span className="font-semibold text-slate-700">{item.label}</span><strong>{item.count}건</strong></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-indigo-600" style={{ width: `${Math.max(6, (item.count / max) * 100)}%` }} /></div></div>)}{items.length === 0 && <p className="py-8 text-center text-sm text-slate-500">{empty}</p>}</div></article>;
}
