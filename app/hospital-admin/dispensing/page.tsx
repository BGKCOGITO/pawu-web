"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabase";
import {
  HospitalPage,
  StatCard,
  StatusBadge,
} from "../../../components/hospital/HospitalPageUI";

function one(value: any) {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

export default function DispensingQueuePage() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [status, setStatus] = useState("active");
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;

    if (!token) {
      setMessage("병원 관리자 로그인이 필요합니다.");
      return;
    }

    const response = await fetch("/api/hospital/dispensing", {
      headers: { authorization: `Bearer ${token}` },
    });
    const result = await response.json();

    if (!response.ok) {
      setMessage(result.message ?? "조제 대기 목록을 불러오지 못했습니다.");
      return;
    }

    setJobs(result.jobs ?? []);
    setMessage("");
  }

  useEffect(() => {
    void load();
  }, []);

  const visible = useMemo(
    () =>
      jobs.filter((job) => {
        const pet = one(job.pets);
        const order = one(job.medication_orders);
        const q = query.trim().toLowerCase();
        const statusOk =
          status === "all"
            ? true
            : status === "active"
              ? ["queued", "in_progress"].includes(job.status)
              : job.status === status;
        const queryOk =
          !q ||
          `${pet?.name ?? ""} ${order?.diagnosis_summary ?? ""} ${
            job.dispensing_items?.map((item: any) => item.medication_name).join(" ") ?? ""
          }`
            .toLowerCase()
            .includes(q);

        return statusOk && queryOk;
      }),
    [jobs, status, query],
  );

  return (
    <HospitalPage
      eyebrow="Dispensing Workflow"
      title="조제 관리"
      description="확정된 처방을 조제 대기·진행·완료 상태로 관리하고 재고를 안전하게 차감합니다."
      actions={
        <button
          type="button"
          onClick={() => void load()}
          className="border border-slate-400 bg-white px-4 py-2 text-sm font-bold"
        >
          새로고침
        </button>
      }
    >
      <section className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="조제 대기"
          value={`${jobs.filter((job) => job.status === "queued").length}건`}
        />
        <StatCard
          label="조제 중"
          value={`${jobs.filter((job) => job.status === "in_progress").length}건`}
        />
        <StatCard
          label="완료"
          value={`${jobs.filter((job) => job.status === "completed").length}건`}
        />
        <StatCard
          label="재고 경고"
          value={`${jobs.reduce(
            (count, job) =>
              count +
              (job.dispensing_items ?? []).filter(
                (item: any) =>
                  !item.inventory_item_id ||
                  Number(item.inventory_items?.current_quantity ?? 0) <
                    Number(item.requested_quantity ?? 0),
              ).length,
            0,
          )}건`}
        />
      </section>

      {message && (
        <div className="mt-3 border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
          {message}
        </div>
      )}

      <section className="mt-4 border border-slate-300 bg-white">
        <div className="grid gap-2 border-b border-slate-300 bg-slate-50 p-3 lg:grid-cols-[1fr_180px]">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="환자명, 진단, 약품명 검색"
            className="border border-slate-300 bg-white px-3 py-2 text-sm"
          />
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            <option value="active">대기·진행</option>
            <option value="all">전체</option>
            <option value="queued">조제 대기</option>
            <option value="in_progress">조제 중</option>
            <option value="completed">조제 완료</option>
            <option value="cancelled">취소</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-left text-sm">
            <thead className="bg-slate-100 text-xs text-slate-600">
              <tr>
                <th className="px-4 py-3">대기 시간</th>
                <th className="px-4 py-3">환자</th>
                <th className="px-4 py-3">처방 목적</th>
                <th className="px-4 py-3">약품</th>
                <th className="px-4 py-3">재고 상태</th>
                <th className="px-4 py-3">상태</th>
                <th className="px-4 py-3">업무</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((job) => {
                const pet = one(job.pets);
                const order = one(job.medication_orders);
                const items = job.dispensing_items ?? [];
                const warnings = items.filter(
                  (item: any) =>
                    !item.inventory_item_id ||
                    Number(item.inventory_items?.current_quantity ?? 0) <
                      Number(item.requested_quantity ?? 0),
                );

                return (
                  <tr
                    key={job.id}
                    className="border-t border-slate-200 align-top hover:bg-slate-50"
                  >
                    <td className="px-4 py-3 text-xs">
                      {job.queued_at
                        ? new Date(job.queued_at).toLocaleString("ko-KR")
                        : "-"}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-black">{pet?.name ?? "환자"}</p>
                      <p className="text-[11px] text-slate-500">
                        {pet?.species ?? "-"} · {pet?.breed ?? "-"}
                      </p>
                    </td>
                    <td className="max-w-[260px] px-4 py-3">
                      {order?.diagnosis_summary || "-"}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-semibold">{items.length}개</p>
                      <p className="mt-1 max-w-[260px] truncate text-xs text-slate-500">
                        {items.map((item: any) => item.medication_name).join(", ")}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      {warnings.length ? (
                        <span className="border border-red-300 bg-red-50 px-2 py-1 text-xs font-bold text-red-700">
                          확인 필요 {warnings.length}
                        </span>
                      ) : (
                        <span className="border border-green-300 bg-green-50 px-2 py-1 text-xs font-bold text-green-700">
                          충분
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge value={job.status} />
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/hospital-admin/dispensing/${job.id}`}
                        className="border border-slate-900 bg-slate-900 px-3 py-2 text-xs font-bold text-white"
                      >
                        조제 화면
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
                    조건에 맞는 조제 작업이 없습니다.
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
