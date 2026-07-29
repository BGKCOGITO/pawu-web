"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { hospitalAuthFetch } from "@/lib/hospital-auth-fetch";

type Reservation = any;

const statusTabs = [
  ["all", "전체"],
  ["requested", "승인 대기"],
  ["approved", "예약 승인"],
  ["completed", "진료 완료"],
  ["rejected", "거절"],
] as const;

function one(value: any) {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function statusLabel(status: string) {
  if (status === "requested") return "승인 대기";
  if (status === "approved") return "예약 승인";
  if (status === "completed") return "진료 완료";
  if (status === "rejected") return "예약 거절";
  if (status === "cancelled") return "예약 취소";
  return status;
}

function statusClass(status: string) {
  if (status === "requested") return "border-amber-300 bg-amber-50 text-amber-800";
  if (status === "approved") return "border-emerald-300 bg-emerald-50 text-emerald-800";
  if (status === "completed") return "border-blue-300 bg-blue-50 text-blue-800";
  if (status === "rejected") return "border-red-300 bg-red-50 text-red-700";
  return "border-slate-300 bg-slate-100 text-slate-700";
}

function highestPriority(preparation: any) {
  const rows = preparation?.visit_preparation_events ?? [];
  const values = rows.flatMap((row: any) => {
    const event = one(row.pet_health_events);
    return event?.priority ? [event.priority] : [];
  });

  if (values.includes("emergency")) return "emergency";
  if (values.includes("high")) return "high";
  if (values.includes("normal")) return "normal";
  if (values.includes("reference")) return "reference";
  return null;
}

function priorityText(priority: string | null) {
  if (priority === "emergency") return "응급 기록 포함";
  if (priority === "high") return "중요 기록 포함";
  if (priority === "normal") return "건강기록 포함";
  if (priority === "reference") return "참고 기록 포함";
  return "일반 예약";
}

export default function HospitalReservationsPage() {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [status, setStatus] = useState("all");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  async function load(nextStatus = status, nextQ = q) {
    setLoading(true);
    setMessage("");

    try {
      const params = new URLSearchParams({
        status: nextStatus,
        q: nextQ,
      });
      const response = await hospitalAuthFetch(
        `/api/hospital/reservations?${params.toString()}`,
      );
      const result = await response.json();

      if (!response.ok) throw new Error(result.message);
      setReservations(result.reservations ?? []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "예약 조회 실패");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load(status, q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const counts = useMemo(() => {
    return reservations.reduce(
      (acc, item) => {
        acc.all += 1;
        if (item.status in acc) acc[item.status] += 1;
        return acc;
      },
      { all: 0, requested: 0, approved: 0, completed: 0, rejected: 0 } as Record<string, number>,
    );
  }, [reservations]);

  return (
    <main className="p-4 lg:p-6">
      <div className="mx-auto max-w-[1500px]">
        <section className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Reservation Center
            </p>
            <h2 className="mt-1 text-2xl font-bold">예약 관리</h2>
            <p className="mt-2 text-sm text-slate-500">
              보호자가 보낸 예약 요청과 진료 준비 자료를 확인합니다.
            </p>
          </div>

          <Link
            href="/hospital-admin/calendar"
            className="border border-slate-400 bg-white px-4 py-2 text-sm font-semibold"
          >
            예약 캘린더
          </Link>
        </section>

        <section className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-5">
          {statusTabs.map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setStatus(value)}
              className={`border px-4 py-3 text-left ${
                status === value
                  ? "border-slate-950 bg-slate-950 text-white"
                  : "border-slate-300 bg-white"
              }`}
            >
              <p className="text-xs opacity-70">{label}</p>
              <p className="mt-1 text-xl font-bold">{counts[value] ?? 0}</p>
            </button>
          ))}
        </section>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            void load(status, q);
          }}
          className="mt-4 flex gap-2"
        >
          <input
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder="환자명, 보호자명, 연락처 검색"
            className="min-w-0 flex-1 border border-slate-300 bg-white px-4 py-3 text-sm"
          />
          <button className="border border-slate-950 bg-slate-950 px-5 py-3 text-sm font-bold text-white">
            검색
          </button>
        </form>

        {message && (
          <div className="mt-4 border border-red-300 bg-red-50 p-4 text-sm text-red-700">
            {message}
          </div>
        )}

        <section className="mt-4 overflow-hidden border border-slate-300 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="bg-slate-100 text-xs text-slate-600">
                <tr>
                  <th className="px-4 py-3">예약 일시</th>
                  <th className="px-4 py-3">환자</th>
                  <th className="px-4 py-3">보호자</th>
                  <th className="px-4 py-3">방문 목적</th>
                  <th className="px-4 py-3">진료 준비</th>
                  <th className="px-4 py-3">상태</th>
                  <th className="px-4 py-3">확인</th>
                </tr>
              </thead>
              <tbody>
                {reservations.map((reservation) => {
                  const pet = one(reservation.pets);
                  const preparation = one(reservation.visit_preparations);
                  const priority = highestPriority(preparation);

                  return (
                    <tr
                      key={reservation.id}
                      className="border-t border-slate-200 hover:bg-slate-50"
                    >
                      <td className="px-4 py-4 font-mono text-xs">
                        {reservation.reservation_date}
                        <br />
                        <strong className="text-sm">
                          {String(reservation.reservation_time).slice(0, 5)}
                        </strong>
                      </td>
                      <td className="px-4 py-4">
                        <p className="font-bold">{pet?.name ?? reservation.pet_name}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {pet?.breed || pet?.species || "정보 없음"}
                        </p>
                      </td>
                      <td className="px-4 py-4">
                        <p className="font-semibold">{reservation.guardian_name}</p>
                        <p className="mt-1 text-xs text-slate-500">{reservation.phone}</p>
                      </td>
                      <td className="px-4 py-4">{reservation.visit_reason || "-"}</td>
                      <td className="px-4 py-4">
                        <p className={`font-bold ${
                          priority === "emergency"
                            ? "text-red-700"
                            : priority === "high"
                              ? "text-amber-700"
                              : "text-slate-700"
                        }`}>
                          {priorityText(priority)}
                        </p>
                        <p className="mt-1 max-w-[280px] truncate text-xs text-slate-500">
                          {preparation?.main_concern ||
                            reservation.symptoms ||
                            "특이사항 없음"}
                        </p>
                      </td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex border px-2 py-1 text-xs font-bold ${statusClass(reservation.status)}`}>
                          {statusLabel(reservation.status)}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <Link
                          href={`/hospital-admin/reservations/${reservation.id}`}
                          className="inline-flex border border-slate-950 bg-white px-3 py-2 text-xs font-bold hover:bg-slate-950 hover:text-white"
                        >
                          상세 보기
                        </Link>
                      </td>
                    </tr>
                  );
                })}

                {!loading && reservations.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-16 text-center text-slate-500">
                      조건에 맞는 예약이 없습니다.
                    </td>
                  </tr>
                )}

                {loading && (
                  <tr>
                    <td colSpan={7} className="px-4 py-16 text-center text-slate-500">
                      예약을 불러오는 중입니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
