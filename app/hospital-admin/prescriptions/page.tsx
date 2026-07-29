"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "../../../lib/supabase";
import {
  HospitalPage,
  StatCard,
  StatusBadge,
  ActionLink,
} from "../../../components/hospital/HospitalPageUI";

function one(value: any) {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function PrescriptionsContent() {
  const searchParams = useSearchParams();
  const petId = searchParams.get("petId");
  const [rows, setRows] = useState<any[]>([]);
  const [status, setStatus] = useState("all");
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;

    if (!token) {
      setMessage("병원 관리자 로그인이 필요합니다.");
      return;
    }

    const response = await fetch("/api/hospital/prescriptions", {
      headers: { authorization: `Bearer ${token}` },
    });

    const result = await response.json();

    if (!response.ok) {
      setMessage(result.message ?? "처방전 목록을 불러오지 못했습니다.");
      return;
    }

    setRows(result.prescriptions ?? []);
    setMessage("");
  }

  useEffect(() => {
    void load();
  }, []);

  const visible = useMemo(
    () =>
      rows.filter((row) => {
        const pet = one(row.pets);
        const q = query.trim().toLowerCase();

        return (
          (status === "all" || row.status === status) &&
          (!petId || String(row.pet_id ?? pet?.id) === petId) &&
          (!q ||
            `${pet?.name ?? ""} ${row.diagnosis_summary ?? ""}`
              .toLowerCase()
              .includes(q))
        );
      }),
    [rows, status, query, petId],
  );

  return (
    <HospitalPage
      eyebrow="Prescription Management"
      title="처방 관리"
      description="작성 중·확정·취소 처방을 환자별로 조회하고 전문 처방 화면으로 연결합니다."
      actions={
        <ActionLink
          href={
            petId
              ? `/hospital-admin/prescriptions/new?petId=${petId}`
              : "/hospital-admin/prescriptions/new"
          }
          primary
        >
          새 처방전
        </ActionLink>
      }
    >
      <section className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="전체" value={`${rows.length}건`} />
        <StatCard
          label="작성 중"
          value={`${rows.filter((row) => row.status === "draft").length}건`}
        />
        <StatCard
          label="확정"
          value={`${rows.filter((row) => row.status === "finalized").length}건`}
        />
        <StatCard
          label="취소"
          value={`${rows.filter((row) => row.status === "cancelled").length}건`}
        />
      </section>

      {petId && (
        <div className="mt-3 flex items-center justify-between border border-blue-300 bg-blue-50 px-4 py-2 text-sm text-blue-900">
          <span>선택한 환자의 처방만 표시 중입니다.</span>
          <Link href="/hospital-admin/prescriptions" className="font-bold">
            필터 해제
          </Link>
        </div>
      )}

      {message && (
        <div className="mt-3 border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
          {message}
        </div>
      )}

      <section className="mt-4 border border-slate-300 bg-white">
        <div className="grid gap-2 border-b border-slate-300 bg-slate-50 p-3 lg:grid-cols-[1fr_180px_auto]">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="환자명 또는 진단·처방 목적 검색"
            className="border border-slate-300 bg-white px-3 py-2 text-sm"
          />

          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            <option value="all">전체 상태</option>
            <option value="draft">작성 중</option>
            <option value="finalized">확정</option>
            <option value="cancelled">취소</option>
          </select>

          <button
            type="button"
            onClick={() => void load()}
            className="border border-slate-400 bg-white px-4 py-2 text-sm font-bold"
          >
            새로고침
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px] text-left text-sm">
            <thead className="bg-slate-100 text-xs text-slate-600">
              <tr>
                <th className="px-4 py-3">작성일</th>
                <th className="px-4 py-3">환자</th>
                <th className="px-4 py-3">진단·처방 목적</th>
                <th className="px-4 py-3">처방 기간</th>
                <th className="px-4 py-3">약품</th>
                <th className="px-4 py-3">상태</th>
                <th className="px-4 py-3">업무</th>
              </tr>
            </thead>

            <tbody>
              {visible.map((row) => {
                const pet = one(row.pets);
                const items =
                  row.medication_order_items ??
                  row.prescription_items ??
                  [];

                return (
                  <tr
                    key={row.id}
                    className="border-t border-slate-200 hover:bg-slate-50"
                  >
                    <td className="px-4 py-3 text-xs">
                      {row.created_at
                        ? new Date(row.created_at).toLocaleDateString("ko-KR")
                        : "-"}
                    </td>

                    <td className="px-4 py-3">
                      <p className="font-black">{pet?.name ?? "환자"}</p>
                      {(row.pet_id ?? pet?.id) && (
                        <Link
                          href={`/hospital-admin/patients/${
                            row.pet_id ?? pet?.id
                          }`}
                          className="text-[11px] font-bold text-blue-700"
                        >
                          환자 상세
                        </Link>
                      )}
                    </td>

                    <td className="max-w-[320px] px-4 py-3">
                      <p className="truncate font-semibold">
                        {row.diagnosis_summary || "-"}
                      </p>
                    </td>

                    <td className="px-4 py-3 text-xs">
                      {row.start_date || "-"}{" "}
                      {row.end_date ? `~ ${row.end_date}` : ""}
                    </td>

                    <td className="px-4 py-3">{items.length}개</td>

                    <td className="px-4 py-3">
                      <StatusBadge value={row.status} />
                    </td>

                    <td className="px-4 py-3">
                      <Link
                        href={`/hospital-admin/prescriptions/${row.id}`}
                        className="border border-slate-400 bg-white px-3 py-2 text-xs font-bold"
                      >
                        처방전 열기
                      </Link>
                    </td>
                  </tr>
                );
              })}

              {!visible.length && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-12 text-center text-slate-500"
                  >
                    조건에 맞는 처방전이 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </HospitalPage>
  );
}

export default function PrescriptionsPage() {
  return (
    <Suspense
      fallback={
        <main className="p-8 text-center text-sm text-slate-500">
          처방 목록을 불러오는 중입니다.
        </main>
      }
    >
      <PrescriptionsContent />
    </Suspense>
  );
}
