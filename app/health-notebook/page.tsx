"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type Pet = {
  id: number;
  name: string;
  species: "dog" | "cat" | "other";
  breed: string | null;
  birth_date: string | null;
  gender: string | null;
  weight_kg: number | null;
};

type TimelineKind =
  | "reservation"
  | "visit"
  | "prescription"
  | "vaccination"
  | "weight"
  | "hospitalization"
  | "inpatient_update"
  | "health_event"
  | "follow_up";

type TimelineEvent = {
  id: string;
  petId: number;
  kind: TimelineKind;
  occurredAt: string;
  title: string;
  summary: string | null;
  hospitalName: string | null;
  status: string | null;
  meta?: Record<string, string | number | boolean | null>;
};

type WeightRecord = {
  id: number;
  pet_id: number;
  weight_kg: number;
  measured_at: string;
  memo: string | null;
};

type Summary = {
  total?: number;
  visits?: number;
  prescriptions?: number;
  hospitalizations?: number;
  upcoming?: number;
};

type FilterKey = "all" | "medical" | "medicine" | "hospital" | "daily";

const filters: Array<{ key: FilterKey; label: string }> = [
  { key: "all", label: "전체" },
  { key: "medical", label: "진료·예약" },
  { key: "medicine", label: "처방" },
  { key: "hospital", label: "입원" },
  { key: "daily", label: "생활기록" },
];

const kindInfo: Record<TimelineKind, { icon: string; label: string; className: string }> = {
  reservation: { icon: "📅", label: "예약", className: "bg-[#eaf3ff] text-[#315a8a]" },
  visit: { icon: "🩺", label: "진료", className: "bg-[#e8f4ef] text-[#153f34]" },
  prescription: { icon: "💊", label: "처방", className: "bg-[#fff2e8] text-[#a85636]" },
  vaccination: { icon: "💉", label: "예방접종", className: "bg-[#f2ecff] text-[#65449a]" },
  weight: { icon: "⚖️", label: "체중", className: "bg-[#eef2f4] text-[#45555c]" },
  hospitalization: { icon: "🏥", label: "입원·퇴원", className: "bg-[#ffecec] text-[#a33b3b]" },
  inpatient_update: { icon: "📝", label: "입원 경과", className: "bg-[#fff7dc] text-[#876c18]" },
  health_event: { icon: "🐾", label: "생활기록", className: "bg-[#f0f5e8] text-[#58713b]" },
  follow_up: { icon: "⏰", label: "예정 관리", className: "bg-[#e9f0ff] text-[#3d5793]" },
};

function petEmoji(species: Pet["species"]) {
  if (species === "dog") return "🐶";
  if (species === "cat") return "🐱";
  return "🐾";
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function statusLabel(status: string | null) {
  const labels: Record<string, string> = {
    requested: "승인 대기",
    approved: "예약 확정",
    rejected: "예약 거절",
    cancelled: "취소",
    completed: "진료 완료",
    admitted: "입원 중",
    in_treatment: "치료 중",
    recovering: "회복 중",
    ready_for_discharge: "퇴원 준비",
    discharged: "퇴원 완료",
    prescribed: "처방 완료",
    scheduled: "예정",
    emergency: "응급",
    high: "중요",
    normal: "보통",
    reference: "참고",
  };
  return status ? labels[status] ?? status : null;
}

function monthKey(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "날짜 미상";
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월`;
}

function buildGraph(records: WeightRecord[]) {
  if (!records.length) return { points: "", min: 0, max: 0 };
  const values = records.map((record) => Number(record.weight_kg));
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(max - min, 0.5);
  const width = 680;
  const height = 210;
  const padX = 36;
  const padY = 26;
  const points = records
    .map((record, index) => {
      const x = records.length === 1 ? width / 2 : padX + (index / (records.length - 1)) * (width - padX * 2);
      const y = padY + ((max - Number(record.weight_kg)) / range) * (height - padY * 2);
      return `${x},${y}`;
    })
    .join(" ");
  return { points, min, max };
}

function HealthTimelineContent() {
  const searchParams = useSearchParams();
  const requestedPetId = Number(searchParams.get("petId"));
  const [pets, setPets] = useState<Pet[]>([]);
  const [selectedPetId, setSelectedPetId] = useState<number | null>(
    Number.isInteger(requestedPetId) ? requestedPetId : null,
  );
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [weights, setWeights] = useState<WeightRecord[]>([]);
  const [summary, setSummary] = useState<Summary>({});
  const [filter, setFilter] = useState<FilterKey>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError("");
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) {
        setError("로그인이 필요합니다.");
        setLoading(false);
        return;
      }

      const query = selectedPetId ? `?petId=${selectedPetId}` : "";
      const response = await fetch(`/api/guardian/health-timeline${query}`, {
        headers: { authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.message ?? "건강 기록을 불러오지 못했습니다.");
        setLoading(false);
        return;
      }

      const loadedPets = (result.pets ?? []) as Pet[];
      setPets(loadedPets);
      if (!selectedPetId && loadedPets[0]) setSelectedPetId(loadedPets[0].id);
      setEvents((result.events ?? []) as TimelineEvent[]);
      setWeights(((result.weightRecords ?? []) as WeightRecord[]).filter((item) => !selectedPetId || item.pet_id === selectedPetId));
      setSummary(result.summary ?? {});
      setLoading(false);
    }
    void load();
  }, [selectedPetId]);

  const selectedPet = pets.find((pet) => pet.id === selectedPetId) ?? pets[0] ?? null;

  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      if (selectedPetId && event.petId !== selectedPetId) return false;
      if (filter === "all") return true;
      if (filter === "medical") return ["reservation", "visit", "follow_up", "vaccination"].includes(event.kind);
      if (filter === "medicine") return event.kind === "prescription";
      if (filter === "hospital") return ["hospitalization", "inpatient_update"].includes(event.kind);
      return ["health_event", "weight"].includes(event.kind);
    });
  }, [events, selectedPetId, filter]);

  const grouped = useMemo(() => {
    const map = new Map<string, TimelineEvent[]>();
    filteredEvents.forEach((event) => {
      const key = monthKey(event.occurredAt);
      map.set(key, [...(map.get(key) ?? []), event]);
    });
    return [...map.entries()];
  }, [filteredEvents]);

  const petWeights = useMemo(
    () => weights.filter((record) => !selectedPetId || record.pet_id === selectedPetId).sort((a, b) => a.measured_at.localeCompare(b.measured_at)),
    [weights, selectedPetId],
  );
  const graph = buildGraph(petWeights);
  const latestWeight = petWeights[petWeights.length - 1];
  const previousWeight = petWeights[petWeights.length - 2];
  const weightDiff = latestWeight && previousWeight ? Number(latestWeight.weight_kg) - Number(previousWeight.weight_kg) : null;

  return (
    <main className="min-h-screen bg-[#f7f4ed] pb-28 text-[#153f34]">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-7 sm:py-10">
        <div className="flex items-center justify-between gap-3">
          <Link href="/" className="rounded-full border border-[#d9d4c9] bg-white px-4 py-2 text-sm font-bold">← PAWU 홈</Link>
          <div className="flex gap-2"><Link href="/health-insights" className="rounded-full border border-[#153f34] bg-white px-4 py-2 text-sm font-bold">AI 건강 요약</Link><Link href={selectedPet ? `/pets/${selectedPet.id}/events/new` : "/pets/new"} className="rounded-full bg-[#153f34] px-4 py-2 text-sm font-bold text-white">
            {selectedPet ? "+ 건강 기록" : "+ 아이 등록"}
          </Link></div>
        </div>

        <header className="mt-7">
          <p className="text-xs font-black tracking-[0.22em] text-[#e56f5b]">PAWU HEALTH STORY</p>
          <h1 className="mt-2 text-3xl font-black sm:text-5xl">우리 아이 건강 타임라인</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[#667069] sm:text-base">
            예약, 진료, 처방, 입원, 퇴원과 보호자가 남긴 생활 기록을 아이별로 한곳에서 확인합니다.
          </p>
        </header>

        {pets.length > 0 && (
          <section className="mt-6 flex gap-3 overflow-x-auto pb-2">
            {pets.map((pet) => {
              const active = pet.id === selectedPetId;
              return (
                <button key={pet.id} type="button" onClick={() => setSelectedPetId(pet.id)} className={`min-w-[168px] rounded-[24px] border p-4 text-left transition ${active ? "border-[#153f34] bg-[#153f34] text-white shadow-lg" : "border-[#ded9ce] bg-white"}`}>
                  <span className="text-2xl">{petEmoji(pet.species)}</span>
                  <strong className="mt-2 block text-lg">{pet.name}</strong>
                  <span className={`mt-1 block text-xs ${active ? "text-white/65" : "text-[#7b817c]"}`}>{pet.breed || (pet.species === "dog" ? "강아지" : pet.species === "cat" ? "고양이" : "반려동물")}</span>
                </button>
              );
            })}
          </section>
        )}

        {error && <div className="mt-6 rounded-[24px] border border-red-200 bg-red-50 p-5 text-sm text-red-700">{error}</div>}

        {!loading && !error && !pets.length && (
          <section className="mt-8 rounded-[30px] border border-dashed border-[#cfc8ba] bg-white p-10 text-center">
            <div className="text-4xl">🐾</div>
            <h2 className="mt-4 text-xl font-black">먼저 우리 아이를 등록해 주세요</h2>
            <p className="mt-2 text-sm text-[#747a75]">아이를 등록하면 건강 기록이 자동으로 연결됩니다.</p>
            <Link href="/pets/new" className="mt-5 inline-flex rounded-full bg-[#153f34] px-5 py-3 text-sm font-bold text-white">아이 등록하기</Link>
          </section>
        )}

        {selectedPet && (
          <>
            <section className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <SummaryCard label="전체 기록" value={summary.total ?? filteredEvents.length} suffix="건" />
              <SummaryCard label="진료 기록" value={summary.visits ?? 0} suffix="건" />
              <SummaryCard label="처방 기록" value={summary.prescriptions ?? 0} suffix="건" />
              <SummaryCard label="예정된 관리" value={summary.upcoming ?? 0} suffix="건" accent />
            </section>

            {petWeights.length > 0 && (
              <section className="mt-5 rounded-[30px] border border-[#e1ddd3] bg-white p-5 shadow-sm sm:p-7">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <p className="text-xs font-black tracking-[0.18em] text-[#e56f5b]">WEIGHT FLOW</p>
                    <h2 className="mt-1 text-2xl font-black">체중 변화</h2>
                  </div>
                  <div className="text-right">
                    <strong className="text-3xl">{Number(latestWeight.weight_kg).toFixed(1)}kg</strong>
                    {weightDiff !== null && <p className={`text-sm font-bold ${weightDiff > 0 ? "text-[#d86652]" : weightDiff < 0 ? "text-[#45756a]" : "text-[#777]"}`}>이전 기록보다 {weightDiff > 0 ? "+" : ""}{weightDiff.toFixed(1)}kg</p>}
                  </div>
                </div>
                <div className="mt-5 overflow-x-auto rounded-[22px] bg-[#f4f7f5] p-3">
                  <svg viewBox="0 0 680 210" className="min-w-[560px] w-full" role="img" aria-label="체중 변화 그래프">
                    <line x1="36" y1="184" x2="644" y2="184" stroke="#cbd5cf" strokeWidth="2" />
                    <polyline points={graph.points} fill="none" stroke="#153f34" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
                    {petWeights.map((record, index) => {
                      const [x, y] = graph.points.split(" ")[index]?.split(",") ?? [0, 0];
                      return <circle key={record.id} cx={x} cy={y} r="7" fill="#fff" stroke="#e56f5b" strokeWidth="4" />;
                    })}
                  </svg>
                </div>
              </section>
            )}

            <section className="mt-6 flex gap-2 overflow-x-auto pb-2">
              {filters.map((item) => (
                <button key={item.key} type="button" onClick={() => setFilter(item.key)} className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-bold ${filter === item.key ? "bg-[#153f34] text-white" : "border border-[#d9d4c9] bg-white text-[#506059]"}`}>
                  {item.label}
                </button>
              ))}
            </section>

            <section className="mt-3">
              {loading ? (
                <div className="rounded-[28px] bg-white p-10 text-center text-sm text-[#777]">건강 기록을 연결하고 있습니다...</div>
              ) : grouped.length === 0 ? (
                <div className="rounded-[28px] border border-dashed border-[#cfc8ba] bg-white p-10 text-center">
                  <p className="text-3xl">🌱</p>
                  <h2 className="mt-3 text-lg font-black">표시할 기록이 아직 없어요</h2>
                  <p className="mt-2 text-sm text-[#747a75]">진료를 받거나 생활 기록을 남기면 이곳에 시간순으로 표시됩니다.</p>
                </div>
              ) : (
                <div className="space-y-8">
                  {grouped.map(([month, monthEvents]) => (
                    <div key={month}>
                      <h2 className="mb-4 text-lg font-black">{month}</h2>
                      <div className="relative space-y-4 before:absolute before:bottom-7 before:left-[25px] before:top-7 before:w-px before:bg-[#d9d4c9]">
                        {monthEvents.map((event) => <TimelineCard key={event.id} event={event} />)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}

export default function HealthTimelinePage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-[#f7f4ed] px-4 py-10 text-[#203b32]">
          <div className="mx-auto max-w-5xl rounded-[28px] border border-[#e1ddd3] bg-white p-8 text-center shadow-sm">
            <p className="text-sm font-bold text-[#68716b]">건강 타임라인을 불러오는 중입니다.</p>
          </div>
        </main>
      }
    >
      <HealthTimelineContent />
    </Suspense>
  );
}

function SummaryCard({ label, value, suffix, accent = false }: { label: string; value: number; suffix: string; accent?: boolean }) {
  return (
    <article className={`rounded-[24px] border p-5 ${accent ? "border-[#e8b8ad] bg-[#fff1ed]" : "border-[#e1ddd3] bg-white"}`}>
      <p className="text-xs font-bold text-[#7a827d]">{label}</p>
      <p className="mt-2 text-2xl font-black">{value}<span className="ml-1 text-sm">{suffix}</span></p>
    </article>
  );
}

function TimelineCard({ event }: { event: TimelineEvent }) {
  const info = kindInfo[event.kind];
  const status = statusLabel(event.status);
  return (
    <article className="relative flex gap-4 rounded-[26px] border border-[#e1ddd3] bg-white p-4 shadow-sm sm:p-5">
      <div className="relative z-10 flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full border-4 border-[#f7f4ed] bg-white text-xl shadow-sm">{info.icon}</div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <span className={`inline-flex rounded-full px-3 py-1 text-[11px] font-black ${info.className}`}>{info.label}</span>
            <h3 className="mt-2 text-lg font-black">{event.title}</h3>
          </div>
          {status && <span className="rounded-full bg-[#f3f1eb] px-3 py-1 text-xs font-bold text-[#68716b]">{status}</span>}
        </div>
        <p className="mt-2 text-xs font-bold text-[#e06e59]">{formatDateTime(event.occurredAt)}</p>
        {event.hospitalName && <p className="mt-2 text-sm font-bold text-[#4d625a]">🏥 {event.hospitalName}</p>}
        {event.summary && <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[#626b65]">{event.summary}</p>}
      </div>
    </article>
  );
}
