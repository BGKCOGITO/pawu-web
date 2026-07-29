"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";

type Verification = {
  id: number;
  hospital_name: string;
  business_number: string | null;
  veterinarian_name: string | null;
  license_number: string | null;
  status: string;
  risk_score: number;
  risk_reasons: string[];
  created_at: string;
};

export default function HospitalVerificationPage() {
  const [items, setItems] = useState<Verification[]>([]);

  async function load() {
    const { data } = await supabase
      .from("hospital_verification_requests")
      .select("id, hospital_name, business_number, veterinarian_name, license_number, status, risk_score, risk_reasons, created_at")
      .order("created_at", { ascending: false });

    setItems((data ?? []) as Verification[]);
  }

  useEffect(() => {
    void load();
  }, []);

  async function update(id: number, status: string) {
    await supabase
      .from("hospital_verification_requests")
      .update({
        status,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", id);

    void load();
  }

  return (
    <main className="min-h-screen bg-gray-50 px-5 py-8 text-black">
      <div className="mx-auto max-w-6xl">
        <Link href="/admin" className="rounded-xl border bg-white px-4 py-2 text-sm">← 관리자</Link>
        <h1 className="mt-8 text-3xl font-black">병원 검증 검토함</h1>
        <p className="mt-2 text-sm text-gray-600">V3에서는 자동 승인 대신 위험 신호를 정리해 관리자 판단을 돕습니다.</p>

        <div className="mt-8 space-y-4">
          {items.map((item) => (
            <article key={item.id} className="rounded-3xl border bg-white p-6">
              <div className="flex flex-wrap justify-between gap-3">
                <div>
                  <strong className="text-xl">{item.hospital_name}</strong>
                  <p className="mt-2 text-sm text-gray-600">
                    사업자번호 {item.business_number ?? "-"} · 수의사 {item.veterinarian_name ?? "-"} · 면허 {item.license_number ?? "-"}
                  </p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-bold ${item.risk_score >= 70 ? "bg-red-100 text-red-700" : item.risk_score >= 40 ? "bg-orange-100 text-orange-700" : "bg-green-100 text-green-700"}`}>
                  위험 점수 {item.risk_score}
                </span>
              </div>

              <div className="mt-5 rounded-2xl bg-gray-50 p-4">
                <p className="text-sm font-bold">확인 필요 사유</p>
                <ul className="mt-2 space-y-1 text-sm text-gray-600">
                  {(item.risk_reasons ?? []).length
                    ? item.risk_reasons.map((reason) => <li key={reason}>• {reason}</li>)
                    : <li>• 자동 감지된 특이사항 없음</li>}
                </ul>
              </div>

              <div className="mt-5 flex gap-2">
                <button onClick={() => void update(item.id, "approved")} className="rounded-xl bg-black px-4 py-2 text-sm text-white">승인</button>
                <button onClick={() => void update(item.id, "needs_documents")} className="rounded-xl border px-4 py-2 text-sm">추가 서류 요청</button>
                <button onClick={() => void update(item.id, "rejected")} className="rounded-xl border border-red-300 px-4 py-2 text-sm text-red-700">거절</button>
              </div>
            </article>
          ))}
        </div>
      </div>
    </main>
  );
}
