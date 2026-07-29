"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";
import type { HospitalMedication } from "../../../lib/v6-5-1-medication-types";

export default function HospitalMedicationsPage() {
  const [items, setItems] = useState<HospitalMedication[]>([]);
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");

  async function token() {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? "";
  }

  async function load() {
    const accessToken = await token();
    if (!accessToken) return;
    const response = await fetch("/api/hospital/medications", {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    const result = await response.json();
    if (!response.ok) {
      setMessage(result.message ?? "약품 목록을 불러오지 못했습니다.");
      return;
    }
    setItems(result.medications ?? []);
  }

  useEffect(() => { void load(); }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => {
      const m = item.central_medications;
      return [
        item.hospital_alias, m?.product_name_ko, m?.product_name_en,
        m?.ingredient_name_ko, m?.ingredient_name_en, m?.manufacturer_name,
      ].some((value) => value?.toLowerCase().includes(q));
    });
  }, [items, query]);

  async function toggle(item: HospitalMedication) {
    const accessToken = await token();
    const response = await fetch("/api/hospital/medications", {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ id: item.id, isActive: !item.is_active }),
    });
    if (response.ok) await load();
  }

  return (
    <main className="p-4 lg:p-6">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Medication Master</p>
            <h1 className="mt-1 text-2xl font-bold">병원 약품 마스터</h1>
            <p className="mt-1 text-sm text-slate-600">
              중앙 약품 DB에서 병원이 실제 사용하는 약품만 선택해 관리합니다.
            </p>
          </div>
          <Link href="/hospital-admin/medications/search"
            className="border border-slate-900 bg-slate-900 px-4 py-2 text-sm font-bold text-white">
            중앙 DB에서 약품 추가
          </Link>
        </div>

        {message && <div className="mt-4 border border-red-300 bg-red-50 p-3 text-sm text-red-700">{message}</div>}

        <div className="mt-4 border border-slate-300 bg-white p-4">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="제품명, 성분명, 제조사 검색"
            className="w-full border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        <div className="mt-4 overflow-x-auto border border-slate-300 bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-100 text-left">
              <tr>
                <th className="px-3 py-2">상태</th>
                <th className="px-3 py-2">제품명</th>
                <th className="px-3 py-2">성분·함량</th>
                <th className="px-3 py-2">제형</th>
                <th className="px-3 py-2">제조사</th>
                <th className="px-3 py-2">분류</th>
                <th className="px-3 py-2">병원 설정</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => {
                const m = item.central_medications;
                return (
                  <tr key={item.id} className="border-t border-slate-200 align-top">
                    <td className="px-3 py-3">
                      <span className={item.is_active ? "font-bold text-emerald-700" : "text-slate-400"}>
                        {item.is_active ? "사용" : "중지"}
                      </span>
                    </td>
                    <td className="px-3 py-3 font-semibold">
                      {item.hospital_alias || m?.product_name_ko || "-"}
                      {item.hospital_alias && <div className="text-xs font-normal text-slate-500">{m?.product_name_ko}</div>}
                    </td>
                    <td className="px-3 py-3">
                      <div>{m?.ingredient_name_ko || m?.ingredient_name_en || "-"}</div>
                      <div className="text-xs text-slate-500">{m?.strength_text || "-"}</div>
                    </td>
                    <td className="px-3 py-3">{m?.dosage_form || "-"}</td>
                    <td className="px-3 py-3">{m?.manufacturer_name || "-"}</td>
                    <td className="px-3 py-3">
                      <div>{m?.medication_category || "-"}</div>
                      {m?.is_anesthetic && <div className="text-xs font-bold text-violet-700">마취·진정</div>}
                      {m?.is_controlled && <div className="text-xs font-bold text-red-700">규제관리 대상</div>}
                    </td>
                    <td className="px-3 py-3 text-xs text-slate-600">
                      재고: {item.stock_unit || "-"}<br />
                      조제: {item.dispensing_unit || "-"}<br />
                      위치: {item.storage_location || "-"}
                    </td>
                    <td className="px-3 py-3 text-right">
                      <button onClick={() => void toggle(item)}
                        className="border border-slate-300 px-3 py-1 text-xs font-semibold">
                        {item.is_active ? "사용 중지" : "다시 사용"}
                      </button>
                    </td>
                  </tr>
                );
              })}
              {!filtered.length && (
                <tr><td colSpan={8} className="px-3 py-10 text-center text-slate-500">등록된 병원 약품이 없습니다.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
