"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

function one<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

export default function GuardianMedicalRecordsPage() {
  const [records, setRecords] = useState<any[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function load() {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) return;

      const response = await fetch("/api/guardian/emr/records", {
        headers: { authorization: `Bearer ${token}` },
      });
      const result = await response.json();

      if (!response.ok) {
        setMessage(result.message ?? "진료기록을 불러오지 못했습니다.");
        return;
      }

      setRecords(result.records ?? []);
    }

    void load();
  }, []);

  return (
    <main className="min-h-screen bg-slate-50 px-5 py-8 text-black">
      <div className="mx-auto max-w-3xl">
        <Link href="/platform" className="rounded-xl border bg-white px-4 py-2 text-sm">
          ← 보호자 홈
        </Link>

        <header className="mt-8">
          <p className="text-sm text-gray-500">PAWU 건강기록</p>
          <h1 className="mt-2 text-3xl font-black">우리 아이 진료기록</h1>
          <p className="mt-3 text-sm text-gray-600">
            병원에서 확정하고 보호자에게 공개한 진료 요약과 복약·재진 안내를 확인합니다.
          </p>
        </header>

        {message && <p className="mt-5 rounded-2xl bg-white p-4 text-sm">{message}</p>}

        <section className="mt-6 space-y-4">
          {records.map((record) => {
            const pet = one(record.pets);
            const hospital = one(record.hospitals);

            return (
              <article key={record.id} className="rounded-3xl border bg-white p-6">
                <div className="flex flex-wrap justify-between gap-3">
                  <div>
                    <p className="text-xs text-gray-500">
                      {record.finalized_at
                        ? new Date(record.finalized_at).toLocaleDateString("ko-KR")
                        : ""}
                    </p>
                    <h2 className="mt-1 text-xl font-black">{pet?.name ?? "반려동물"}</h2>
                    <p className="mt-1 text-sm text-gray-500">{hospital?.name ?? "동물병원"}</p>
                  </div>
                  {record.follow_up_date && (
                    <span className="rounded-full bg-orange-100 px-4 py-2 text-sm font-bold text-orange-700">
                      재진 {record.follow_up_date}
                    </span>
                  )}
                </div>

                {record.guardian_summary && (
                  <section className="mt-5 rounded-2xl bg-blue-50 p-5">
                    <h3 className="font-black text-blue-900">병원 안내</h3>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-blue-900">
                      {record.guardian_summary}
                    </p>
                  </section>
                )}

                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <Summary title="진단 요약" value={record.diagnosis_summary} />
                  <Summary title="처치·치료 요약" value={record.treatment_summary} />
                </div>

                {(record.emr_prescriptions ?? []).length > 0 && (
                  <section className="mt-5">
                    <h3 className="font-black">복약 안내</h3>
                    <div className="mt-3 space-y-2">
                      {(record.emr_prescriptions ?? []).map((item: any) => (
                        <div key={item.id} className="rounded-xl bg-gray-50 p-4 text-sm">
                          <strong>{item.medication_name}</strong>
                          <p className="mt-1 text-gray-600">
                            {[item.dosage, item.unit, item.frequency, item.duration_days ? `${item.duration_days}일` : null].filter(Boolean).join(" · ")}
                          </p>
                          {item.instructions && <p className="mt-2">{item.instructions}</p>}
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {(record.emr_followups ?? []).length > 0 && (
                  <section className="mt-5">
                    <h3 className="font-black">예정된 관리</h3>
                    <div className="mt-3 space-y-2">
                      {(record.emr_followups ?? []).map((item: any) => (
                        <div key={item.id} className="flex justify-between rounded-xl bg-gray-50 p-4 text-sm">
                          <span>{item.title}</span>
                          <strong>{item.due_date || "날짜 미정"}</strong>
                        </div>
                      ))}
                    </div>
                  </section>
                )}
              </article>
            );
          })}

          {!records.length && !message && (
            <p className="rounded-3xl border bg-white p-10 text-center text-sm text-gray-500">
              병원에서 확정한 진료기록이 아직 없습니다.
            </p>
          )}
        </section>
      </div>
    </main>
  );
}

function Summary({ title, value }: { title: string; value: string | null }) {
  return (
    <section className="rounded-2xl border p-4">
      <h3 className="font-black">{title}</h3>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-gray-600">
        {value || "공개된 내용이 없습니다."}
      </p>
    </section>
  );
}
