"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";

const menus = [
  ["/admin/reservations", "예약 관리", "예약 요청·승인·상태 변경"],
  ["/hospital-admin/billing/new", "간편 청구", "진료 항목을 선택해 청구서 작성"],
  ["/hospital-admin/inventory/usage-review", "재고 사용량 검토", "진료 완료 전 실제 사용량 확인"],
  ["/hospital-admin/inventory", "재고 관리", "현재 재고·부족 재고·유효기간"],
  ["/hospital-admin/inventory/service-mappings", "진료–재고 연결", "항목별 기본 재고 사용량 설정"],
  ["/hospital-admin/staff", "직원 관리", "역할과 업무 권한"],
  ["/hospital-admin/analytics", "운영 통계", "예약과 병원 운영 지표"],
  ["/hospital-admin/billing/catalog", "진료 항목 설정", "병원별 진료 항목과 기본 금액"],
];

export default function HospitalDashboardV61Page() {
  const [data, setData] = useState<any>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function load() {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      if (!token) return;

      const response = await fetch("/api/hospital/dashboard/v6-1", {
        headers: { authorization: `Bearer ${token}` },
      });
      const result = await response.json();

      if (!response.ok) {
        setMessage(result.message ?? "대시보드를 불러오지 못했습니다.");
        return;
      }

      setData(result.data);
    }

    void load();
  }, []);

  return (
    <main className="min-h-screen bg-slate-50 px-5 py-8 text-black">
      <div className="mx-auto max-w-7xl">
        <header className="rounded-[2rem] bg-black p-8 text-white">
          <p className="text-sm text-gray-300">PAWU HOSPITAL V6.1</p>
          <h1 className="mt-2 text-3xl font-black">병원 운영 대시보드</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-gray-300">
            예약, 청구, 결제 대기, 재고와 진료 후 사용량 확정을 한곳에서 확인합니다.
          </p>
        </header>

        {message && <p className="mt-5 rounded-2xl bg-white p-4 text-sm">{message}</p>}

        <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Metric title="오늘 예약" value={`${data?.todayReservations ?? 0}건`} />
          <Metric title="예약 승인 대기" value={`${data?.requestedReservations ?? 0}건`} warn />
          <Metric title="결제 대기" value={`${data?.paymentPending ?? 0}건`} warn />
          <Metric title="이번 달 청구액" value={`${Number(data?.monthRevenue ?? 0).toLocaleString("ko-KR")}원`} />
        </section>

        <section className="mt-5 grid gap-5 lg:grid-cols-2">
          <Link href="/hospital-admin/inventory" className="rounded-3xl border border-red-200 bg-red-50 p-6">
            <div className="flex justify-between gap-3">
              <h2 className="text-xl font-black text-red-900">부족 재고</h2>
              <strong className="text-red-700">{data?.lowStockCount ?? 0}개</strong>
            </div>
            <div className="mt-4 space-y-2">
              {(data?.lowStock ?? []).map((item: any) => (
                <div key={item.id} className="flex justify-between rounded-xl bg-white p-3 text-sm">
                  <span>{item.name}</span>
                  <strong>{item.current_quantity} / {item.minimum_quantity} {item.unit}</strong>
                </div>
              ))}
              {!data?.lowStock?.length && <p className="text-sm text-red-700">현재 부족 품목이 없습니다.</p>}
            </div>
          </Link>

          <Link href="/hospital-admin/inventory" className="rounded-3xl border border-orange-200 bg-orange-50 p-6">
            <h2 className="text-xl font-black text-orange-900">60일 내 유효기간 임박</h2>
            <div className="mt-4 space-y-2">
              {(data?.expiringLots ?? []).map((lot: any) => (
                <div key={lot.id} className="flex justify-between rounded-xl bg-white p-3 text-sm">
                  <span>{lot.inventory_items?.name} · {lot.lot_number}</span>
                  <strong>{lot.expires_on}</strong>
                </div>
              ))}
              {!data?.expiringLots?.length && <p className="text-sm text-orange-700">임박한 로트가 없습니다.</p>}
            </div>
          </Link>
        </section>

        <section className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {menus.map(([href, title, description]) => (
            <Link key={href} href={href} className="rounded-3xl border bg-white p-5 transition hover:border-black">
              <h2 className="text-lg font-black">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-gray-600">{description}</p>
            </Link>
          ))}
        </section>
      </div>
    </main>
  );
}

function Metric({
  title,
  value,
  warn = false,
}: {
  title: string;
  value: string;
  warn?: boolean;
}) {
  return (
    <article className={`rounded-3xl border p-5 ${warn ? "bg-orange-50" : "bg-white"}`}>
      <p className="text-sm text-gray-500">{title}</p>
      <p className="mt-2 text-2xl font-black">{value}</p>
    </article>
  );
}
