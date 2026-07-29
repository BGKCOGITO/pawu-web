"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

function one<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

export default function GuardianLabResultsPage() {
  const [results, setResults] = useState<any[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function load() {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) return;

      const response = await fetch("/api/guardian/lab-results", {
        headers: { authorization: `Bearer ${token}` },
      });
      const result = await response.json();

      if (!response.ok) {
        setMessage(result.message ?? "검사 결과를 불러오지 못했습니다.");
        return;
      }

      setResults(result.results ?? []);
    }

    void load();
  }, []);

  return (
    <main className="min-h-screen bg-slate-50 px-5 py-8 text-black">
      <div className="mx-auto max-w-4xl">
        <Link href="/platform" className="rounded-xl border bg-white px-4 py-2 text-sm">← 보호자 홈</Link>
        <header className="mt-8">
          <p className="text-sm text-gray-500">PAWU 건강기록</p>
          <h1 className="mt-2 text-3xl font-black">검사 결과</h1>
          <p className="mt-3 text-sm text-gray-600">
            병원이 확정하고 공개한 검사 결과와 설명을 확인합니다.
          </p>
        </header>

        {message && <p className="mt-5 rounded-2xl bg-white p-4 text-sm">{message}</p>}

        <section className="mt-6 space-y-5">
          {results.map((result) => {
            const pet = one(result.pets);
            const hospital = one(result.hospitals);
            const values = [...(result.lab_result_values ?? [])].sort((a: any, b: any) => a.sort_order - b.sort_order);

            return (
              <article key={result.id} className="rounded-3xl border bg-white p-6">
                <div className="flex flex-wrap justify-between gap-3">
                  <div>
                    <p className="text-xs text-gray-500">
                      {result.finalized_at ? new Date(result.finalized_at).toLocaleDateString("ko-KR") : ""}
                    </p>
                    <h2 className="mt-1 text-xl font-black">{pet?.name ?? "반려동물"}</h2>
                    <p className="mt-1 text-sm text-gray-500">{hospital?.name ?? "동물병원"} · {result.category} · {result.test_name}</p>
                  </div>
                </div>

                <section className="mt-5 rounded-2xl bg-blue-50 p-5">
                  <h3 className="font-black text-blue-900">병원 설명</h3>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-blue-900">
                    {result.guardian_summary || "병원에서 공개한 설명이 없습니다."}
                  </p>
                </section>

                {values.length > 0 && (
                  <div className="mt-5 overflow-x-auto">
                    <table className="w-full min-w-[620px] text-left text-sm">
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="p-3">항목</th><th className="p-3">결과</th>
                          <th className="p-3">단위</th><th className="p-3">참고범위</th><th className="p-3">표시</th>
                        </tr>
                      </thead>
                      <tbody>
                        {values.map((value: any) => (
                          <tr key={value.id} className="border-t">
                            <td className="p-3 font-bold">{value.analyte_name}</td>
                            <td className="p-3">{value.result_value ?? value.result_text ?? "-"}</td>
                            <td className="p-3">{value.unit ?? "-"}</td>
                            <td className="p-3">{value.reference_text ?? [value.reference_low, value.reference_high].filter((x) => x != null).join(" ~ ")}</td>
                            <td className={`p-3 font-bold ${value.abnormal_flag === "high" || value.abnormal_flag === "low" ? "text-red-600" : ""}`}>
                              {value.abnormal_flag}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {(result.lab_attachments ?? []).length > 0 && (
                  <section className="mt-5">
                    <h3 className="font-black">첨부 결과</h3>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      {(result.lab_attachments ?? []).map((attachment: any) => (
                        attachment.signedUrl ? (
                          <a key={attachment.id} href={attachment.signedUrl} target="_blank" rel="noreferrer" className="rounded-xl border p-4 text-sm font-bold">
                            {attachment.file_name} 열기
                          </a>
                        ) : null
                      ))}
                    </div>
                  </section>
                )}
              </article>
            );
          })}

          {!results.length && !message && (
            <p className="rounded-3xl border bg-white p-10 text-center text-sm text-gray-500">
              병원에서 공개한 검사 결과가 아직 없습니다.
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
