"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

type DashboardData = {
  pets: Array<{ id: number; name: string; species: string; breed: string | null; weight_kg: number | null }>;
  reservations: Array<any>;
  recentRecords: Array<any>;
  medications: Array<any>;
  vaccinations: Array<any>;
  unreadNotifications: number;
  unreadChats: number;
};

function one<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

export default function GuardianPlatformPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function load() {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      if (!token) {
        setMessage("로그인 후 보호자 홈을 이용할 수 있습니다.");
        return;
      }

      const response = await fetch("/api/platform/guardian-dashboard", {
        headers: { authorization: `Bearer ${token}` },
      });
      const result = await response.json();
      if (!response.ok) {
        setMessage(result.message ?? "보호자 홈을 불러오지 못했습니다.");
        return;
      }
      setData(result.data);
    }

    void load();
  }, []);

  if (!data) {
    return <main className="min-h-screen bg-gray-50 p-8 text-center text-gray-600">{message || "PAWU 홈을 준비하는 중입니다."}</main>;
  }

  const nextReservation = data.reservations[0];

  return (
    <main className="min-h-screen bg-slate-50 px-5 py-6 text-black">
      <div className="mx-auto max-w-6xl">
        <header className="rounded-[2rem] bg-black p-7 text-white">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div>
              <p className="text-sm text-gray-300">Always with us</p>
              <h1 className="mt-2 text-3xl font-black">PAWU 보호자 홈</h1>
              <p className="mt-3 text-sm text-gray-300">예약, 건강기록, 복약, 채팅을 한 곳에서 확인합니다.</p>
            </div>
            <div className="flex gap-2">
              <Link href="/notifications" className="rounded-xl bg-white px-4 py-3 text-sm font-bold text-black">
                알림 {data.unreadNotifications ? `(${data.unreadNotifications})` : ""}
              </Link>
              <Link href="/chat" className="rounded-xl border border-white/40 px-4 py-3 text-sm font-bold">
                채팅 {data.unreadChats ? `(${data.unreadChats})` : ""}
              </Link>
            </div>
          </div>
        </header>

        <section className="mt-6 grid gap-4 md:grid-cols-4">
          <Metric title="등록 반려동물" value={`${data.pets.length}마리`} href="/pets" />
          <Metric title="예정 예약" value={`${data.reservations.length}건`} href="/my-reservations" />
          <Metric title="복약 일정" value={`${data.medications.length}건`} href="/medications" />
          <Metric title="30일 내 예방접종" value={`${data.vaccinations.length}건`} href="/health-notebook" />
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_.9fr]">
          <section className="rounded-3xl border bg-white p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-black">다음 예약</h2>
              <Link href="/map" className="text-sm font-bold text-blue-700">병원 찾기</Link>
            </div>

            {nextReservation ? (
              <article className="mt-5 rounded-2xl bg-blue-50 p-5">
                <p className="text-xs font-bold text-blue-700">{nextReservation.status}</p>
                <h3 className="mt-2 text-xl font-black">{one(nextReservation.hospitals)?.name ?? "동물병원"}</h3>
                <p className="mt-2 text-sm text-gray-700">
                  {nextReservation.reservation_date} {String(nextReservation.reservation_time).slice(0, 5)}
                  {" · "}
                  {one(nextReservation.pets)?.name ?? "반려동물"}
                </p>
                <div className="mt-4 flex gap-2">
                  <Link href="/my-reservations" className="rounded-xl bg-black px-4 py-2 text-sm text-white">예약 보기</Link>
                  <Link href={`/my-reservations/${nextReservation.id}/chat`} className="rounded-xl border border-black px-4 py-2 text-sm">병원 채팅</Link>
                </div>
              </article>
            ) : (
              <div className="mt-5 rounded-2xl bg-gray-50 p-6 text-sm text-gray-500">예정된 예약이 없습니다.</div>
            )}
          </section>

          <section className="rounded-3xl border bg-white p-6">
            <h2 className="text-xl font-black">우리 아이</h2>
            <div className="mt-5 space-y-3">
              {data.pets.map((pet) => (
                <Link key={pet.id} href="/pets" className="flex items-center justify-between rounded-2xl border p-4">
                  <div>
                    <strong>{pet.name}</strong>
                    <p className="mt-1 text-xs text-gray-500">{pet.species} · {pet.breed ?? "품종 미입력"}</p>
                  </div>
                  <span className="text-sm font-bold">{pet.weight_kg ?? "-"}kg</span>
                </Link>
              ))}
            </div>
          </section>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <section className="rounded-3xl border bg-white p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-black">오늘의 건강 일정</h2>
              <Link href="/medications" className="text-sm font-bold text-blue-700">전체 보기</Link>
            </div>
            <div className="mt-5 space-y-3">
              {data.medications.slice(0, 5).map((item) => (
                <article key={item.id} className="rounded-2xl bg-emerald-50 p-4">
                  <strong>{item.medication_name}</strong>
                  <p className="mt-1 text-sm text-gray-600">{one(item.pets)?.name ?? "반려동물"} · {item.dosage ?? "용량 확인"} · {(item.times ?? []).join(", ")}</p>
                </article>
              ))}
              {!data.medications.length && <p className="text-sm text-gray-500">진행 중인 복약 일정이 없습니다.</p>}
            </div>
          </section>

          <section className="rounded-3xl border bg-white p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-black">최근 진료</h2>
              <Link href="/health-notebook" className="text-sm font-bold text-blue-700">건강수첩</Link>
            </div>
            <div className="mt-5 space-y-3">
              {data.recentRecords.map((record) => (
                <Link key={record.id} href={`/health-notebook/record/${record.id}`} className="block rounded-2xl border p-4">
                  <div className="flex justify-between gap-3">
                    <strong>{one(record.pets)?.name ?? "반려동물"}</strong>
                    <span className="text-xs text-gray-500">{record.created_at.slice(0, 10)}</span>
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm text-gray-600">{record.diagnosis}</p>
                </Link>
              ))}
              {!data.recentRecords.length && <p className="text-sm text-gray-500">아직 등록된 진료기록이 없습니다.</p>}
            </div>
          </section>
        </div>

        <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Quick href="/ai-care" title="AI 증상 안내" description="증상을 정리하고 상담 시점을 확인합니다." />
          <Quick href="/map" title="병원 검색" description="지도에서 가까운 동물병원을 찾습니다." />
          <Quick href="/chat" title="병원 채팅" description="승인된 예약의 병원과 대화합니다." />
          <Quick href="/policies" title="정책 및 안전" description="개인정보와 AI 안내 원칙을 확인합니다." />
        </section>
      </div>
    </main>
  );
}

function Metric({ title, value, href }: { title: string; value: string; href: string }) {
  return (
    <Link href={href} className="rounded-3xl border bg-white p-5">
      <p className="text-sm text-gray-500">{title}</p>
      <p className="mt-2 text-2xl font-black">{value}</p>
    </Link>
  );
}

function Quick({ href, title, description }: { href: string; title: string; description: string }) {
  return (
    <Link href={href} className="rounded-3xl border bg-white p-5 transition hover:border-black">
      <strong>{title}</strong>
      <p className="mt-2 text-sm leading-6 text-gray-600">{description}</p>
    </Link>
  );
}
