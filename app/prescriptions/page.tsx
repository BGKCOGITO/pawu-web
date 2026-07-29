"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

function one<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

export default function GuardianPrescriptionsPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function load() {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) return;

      const response = await fetch("/api/guardian/prescriptions", {
        headers: { authorization: `Bearer ${token}` },
      });

      const result = await response.json();

      if (!response.ok) {
        setMessage(result.message ?? "처방전을 불러오지 못했습니다.");
        return;
      }

      setRows(result.prescriptions ?? []);
    }

    void load();
  }, []);

  return (
    <main className="min-h-screen bg-slate-50 px-5 py-8 text-black">
      <div className="mx-auto max-w-4xl">
        <Link href="/platform" className="rounded-xl border bg-white px-4 py-2 text-sm">
          ← 보호자 홈
        </Link>

        <header className="mt-8">
          <p className="text-sm text-slate-500">PAWU 건강기록</p>
          <h1 className="mt-2 text-3xl font-black">처방전·복약 안내</h1>
          <p className="mt-3 text-sm text-slate-600">
            병원에서 확정하고 공개한 처방전과 복약 안내를 확인합니다.
          </p>
        </header>

        {message && (
          <p className="mt-5 rounded-2xl bg-white p-4 text-sm">{message}</p>
        )}

        <section className="mt-6 space-y-5">
          {rows.map((row) => {
            const pet = one(row.pets);
            const hospital = one(row.hospitals);
            const items = [...(row.prescription_items ?? [])].sort(
              (a: any, b: any) => a.sort_order - b.sort_order,
            );

            return (
              <article key={row.id} className="rounded-3xl border bg-white p-6">
                <div className="flex flex-wrap justify-between gap-3">
                  <div>
                    <p className="text-xs text-slate-500">
                      {row.finalized_at
                        ? new Date(row.finalized_at).toLocaleDateString("ko-KR")
                        : ""}
                    </p>
                    <h2 className="mt-1 text-xl font-black">{pet?.name ?? "반려동물"}</h2>
                    <p className="mt-1 text-sm text-slate-500">
                      {hospital?.name ?? "동물병원"}
                    </p>
                  </div>

                  <p className="text-sm font-semibold text-slate-700">
                    {row.start_date || "-"} ~ {row.end_date || "-"}
                  </p>
                </div>

                {row.diagnosis_summary && (
                  <section className="mt-5 rounded-2xl bg-slate-100 p-4">
                    <h3 className="font-black">처방 목적</h3>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6">
                      {row.diagnosis_summary}
                    </p>
                  </section>
                )}

                <section className="mt-5 rounded-2xl bg-blue-50 p-5">
                  <h3 className="font-black text-blue-900">병원 복약 안내</h3>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-blue-900">
                    {row.guardian_note || "병원에서 공개한 안내가 없습니다."}
                  </p>
                </section>

                <div className="mt-5 space-y-3">
                  {items.map((item: any) => (
                    <section key={item.id} className="rounded-2xl border p-4">
                      <h3 className="font-black">{item.medication_name}</h3>
                      <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                        <p><strong>1회 용량:</strong> {item.dose_amount} {item.dose_unit}</p>
                        <p><strong>투여경로:</strong> {item.route}</p>
                        <p><strong>횟수:</strong> {item.frequency}</p>
                        <p><strong>기간:</strong> {item.duration_days ? `${item.duration_days}일` : "-"}</p>
                      </div>

                      {item.instructions && (
                        <p className="mt-3 rounded-xl bg-slate-50 p-3 text-sm">
                          {item.instructions}
                        </p>
                      )}

                      {item.warning_note && (
                        <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
                          주의: {item.warning_note}
                        </p>
                      )}
                    </section>
                  ))}
                </div>

                <p className="mt-5 text-xs leading-5 text-slate-500">
                  약 복용 중 이상 반응이 있거나 안내와 다르게 복용한 경우 처방 병원에 문의해 주세요.
                </p>
              </article>
            );
          })}

          {!rows.length && !message && (
            <p className="rounded-3xl border bg-white p-10 text-center text-sm text-slate-500">
              병원에서 공개한 처방전이 아직 없습니다.
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
