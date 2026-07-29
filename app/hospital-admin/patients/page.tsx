"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { hospitalAuthFetch } from "@/lib/hospital-auth-fetch";

function one(value: any) {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

export default function PatientsPage() {
  const [patients, setPatients] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  async function load() {
    setLoading(true);
    try {
      const response = await hospitalAuthFetch(
        `/api/hospital/patients?q=${encodeURIComponent(q)}`,
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      setPatients(result.patients ?? []);
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "환자 조회 실패");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="p-4 lg:p-6">
      <div className="mx-auto max-w-[1500px]">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Patient Registry
          </p>
          <h2 className="mt-1 text-2xl font-bold">환자 관리</h2>
          <p className="mt-2 text-sm text-slate-500">
            예약 승인된 반려동물은 병원 환자로 자동 등록됩니다.
          </p>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void load();
          }}
          className="mt-5 flex gap-2"
        >
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="환자명, 품종, 보호자명, 연락처 검색"
            className="min-w-0 flex-1 border border-slate-300 bg-white px-4 py-3"
          />
          <button className="bg-slate-950 px-5 py-3 font-bold text-white">
            검색
          </button>
        </form>

        {message && (
          <div className="mt-4 border border-red-300 bg-red-50 p-4 text-red-700">
            {message}
          </div>
        )}

        <section className="mt-4 overflow-hidden border border-slate-300 bg-white">
          <table className="w-full min-w-[850px] text-left text-sm">
            <thead className="bg-slate-100 text-xs text-slate-600">
              <tr>
                <th className="px-4 py-3">환자번호</th>
                <th className="px-4 py-3">환자</th>
                <th className="px-4 py-3">보호자</th>
                <th className="px-4 py-3">최근 방문</th>
                <th className="px-4 py-3">차트</th>
              </tr>
            </thead>
            <tbody>
              {patients.map((row) => {
                const pet = one(row.pets);
                const reservation = one(row.reservations);
                return (
                  <tr key={row.id} className="border-t border-slate-200">
                    <td className="px-4 py-4 font-mono text-xs">
                      {row.patient_number || `P-${row.id}`}
                    </td>
                    <td className="px-4 py-4">
                      <p className="font-bold">{pet?.name}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {pet?.breed || pet?.species || "정보 없음"}
                      </p>
                    </td>
                    <td className="px-4 py-4">
                      <p className="font-semibold">{reservation?.guardian_name || "-"}</p>
                      <p className="mt-1 text-xs text-slate-500">{reservation?.phone || "-"}</p>
                    </td>
                    <td className="px-4 py-4">{row.last_visit_at ? new Date(row.last_visit_at).toLocaleDateString("ko-KR") : "첫 방문 전"}</td>
                    <td className="px-4 py-4">
                      <Link
                        href={`/hospital-admin/patients/${row.id}`}
                        className="border border-slate-950 px-3 py-2 text-xs font-bold hover:bg-slate-950 hover:text-white"
                      >
                        환자 상세
                      </Link>
                    </td>
                  </tr>
                );
              })}

              {!loading && patients.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-16 text-center text-slate-500">
                    등록된 환자가 없습니다. 예약을 승인하면 자동 등록됩니다.
                  </td>
                </tr>
              )}

              {loading && (
                <tr>
                  <td colSpan={5} className="px-4 py-16 text-center text-slate-500">
                    환자를 불러오는 중입니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      </div>
    </main>
  );
}
