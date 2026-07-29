"use client";

import { useState } from "react";
import Link from "next/link";
import { supabase } from "../../../../lib/supabase";
import type { CentralMedication } from "../../../../lib/v6-5-1-medication-types";

export default function MedicationSearchPage() {
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<CentralMedication[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function getToken() {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? "";
  }

  async function search() {
    if (query.trim().length < 2) {
      setMessage("두 글자 이상 입력해 주세요.");
      return;
    }
    setLoading(true);
    setMessage("");
    const token = await getToken();
    const response = await fetch(`/api/hospital/medications/search?q=${encodeURIComponent(query.trim())}`, {
      headers: { authorization: `Bearer ${token}` },
    });
    const result = await response.json();
    setLoading(false);
    if (!response.ok) {
      setMessage(result.message ?? "검색하지 못했습니다.");
      return;
    }
    setItems(result.medications ?? []);
    if (!(result.medications ?? []).length) setMessage("검색 결과가 없습니다.");
  }

  async function add(item: CentralMedication) {
    const token = await getToken();
    const response = await fetch("/api/hospital/medications", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        centralMedicationId: item.id,
        stockUnit: item.dosage_form?.includes("주") ? "mL" : null,
        dispensingUnit: item.dosage_form?.includes("정") ? "정" : null,
      }),
    });
    const result = await response.json();
    if (!response.ok) {
      setMessage(result.message ?? "추가하지 못했습니다.");
      return;
    }
    setMessage(`${item.product_name_ko}을(를) 병원 약품에 추가했습니다.`);
  }

  return (
    <main className="p-4 lg:p-6">
      <div className="mx-auto max-w-6xl">
        <Link href="/hospital-admin/medications" className="text-sm font-semibold text-slate-600">← 병원 약품 마스터</Link>
        <h1 className="mt-3 text-2xl font-bold">중앙 약품 DB 검색</h1>
        <p className="mt-1 text-sm text-slate-600">
          제품명, 성분명 또는 제조사로 검색한 뒤 병원에서 사용하는 약품만 추가합니다.
        </p>

        <div className="mt-4 flex gap-2 border border-slate-300 bg-white p-4">
          <input value={query} onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") void search(); }}
            placeholder="예: 아목시실린, 프로포폴, isoflurane"
            className="min-w-0 flex-1 border border-slate-300 px-3 py-2" />
          <button onClick={() => void search()}
            className="border border-slate-900 bg-slate-900 px-5 py-2 font-bold text-white">
            {loading ? "검색 중" : "검색"}
          </button>
        </div>

        {message && <div className="mt-3 border border-slate-300 bg-slate-50 p-3 text-sm">{message}</div>}

        <div className="mt-4 space-y-2">
          {items.map((item) => (
            <article key={item.id} className="border border-slate-300 bg-white p-4">
              <div className="flex flex-wrap justify-between gap-4">
                <div>
                  <h2 className="font-bold">{item.product_name_ko}</h2>
                  <p className="text-xs text-slate-500">{item.product_name_en || "-"}</p>
                  <div className="mt-2 grid gap-x-8 gap-y-1 text-sm md:grid-cols-2">
                    <p><strong>성분:</strong> {item.ingredient_name_ko || item.ingredient_name_en || "-"}</p>
                    <p><strong>함량:</strong> {item.strength_text || "-"}</p>
                    <p><strong>제형:</strong> {item.dosage_form || "-"}</p>
                    <p><strong>제조사:</strong> {item.manufacturer_name || "-"}</p>
                    <p><strong>분류:</strong> {item.medication_category || "-"}</p>
                    <p><strong>허가상태:</strong> {item.approval_status || "-"}</p>
                  </div>
                  <div className="mt-2 flex gap-2 text-xs font-bold">
                    {item.is_anesthetic && <span className="border border-violet-300 bg-violet-50 px-2 py-1 text-violet-700">마취·진정</span>}
                    {item.is_controlled && <span className="border border-red-300 bg-red-50 px-2 py-1 text-red-700">규제관리 대상</span>}
                  </div>
                </div>
                <button onClick={() => void add(item)}
                  className="h-fit border border-slate-900 px-4 py-2 text-sm font-bold">
                  병원 약품에 추가
                </button>
              </div>
            </article>
          ))}
        </div>
      </div>
    </main>
  );
}
