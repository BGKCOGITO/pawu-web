"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { hospitalAuthFetch } from "@/lib/hospital-auth-fetch";

export default function EmrStartPage() {
  const router = useRouter();
  const [reservationId, setReservationId] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  async function startChart() {
    setSaving(true);
    setMessage("");
    try {
      const response = await hospitalAuthFetch("/api/hospital/medical-records", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reservation_id: Number(reservationId) }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      router.push(`/hospital-admin/emr/${result.record_id}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "차트 생성 실패");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="p-4 lg:p-6">
      <div className="mx-auto max-w-3xl">
        <section className="border border-slate-300 bg-white p-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Electronic Medical Record
          </p>
          <h2 className="mt-1 text-2xl font-bold">전자차트 열기</h2>
          <p className="mt-2 text-sm text-slate-500">
            예약번호를 입력하면 해당 예약의 보호자 정보와 PAWU 진료 준비 요약을 불러옵니다.
          </p>

          <label className="mt-6 block">
            <span className="text-sm font-bold">예약번호</span>
            <input
              value={reservationId}
              onChange={(e) => setReservationId(e.target.value)}
              inputMode="numeric"
              placeholder="예: 254"
              className="mt-2 w-full border border-slate-300 px-4 py-3"
            />
          </label>

          {message && (
            <div className="mt-4 border border-red-300 bg-red-50 p-4 text-sm text-red-700">
              {message}
            </div>
          )}

          <button
            type="button"
            disabled={saving || !reservationId}
            onClick={() => void startChart()}
            className="mt-5 w-full bg-slate-950 px-4 py-3 font-bold text-white disabled:opacity-40"
          >
            {saving ? "차트를 준비하는 중..." : "전자차트 시작"}
          </button>
        </section>
      </div>
    </main>
  );
}
