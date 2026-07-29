"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabase";

type WorkflowRow = {
  reservationId: number;
  invoiceId: number | null;
  petId: number | null;
  petName: string;
  species: string | null;
  breed: string | null;
  guardianName: string;
  phone: string | null;
  reservationDate: string;
  reservationTime: string;
  visitReason: string | null;
  symptoms: string | null;
  reservationStatus: string;
  invoiceStatus: string | null;
  totalAmount: number | null;
  inventoryFinalizedAt: string | null;
  workflowStatus: string;
};

const statusLabels: Record<string, string> = {
  reservation_requested: "승인 대기",
  scheduled: "예약 확정",
  arrived: "접수",
  in_progress: "진료 중",
  billing: "청구 작성",
  payment_pending: "결제 대기",
  paid: "결제 완료",
  inventory_review: "재고 검토",
  completed: "진료 완료",
  cancelled: "취소",
};

export default function WorkflowPage() {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [rows, setRows] = useState<WorkflowRow[]>([]);
  const [filter, setFilter] = useState("all");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function token() {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? "";
  }

  async function load() {
    setLoading(true);
    const accessToken = await token();

    if (!accessToken) {
      setLoading(false);
      return;
    }

    const response = await fetch(`/api/hospital/workflow/v6-2?date=${date}`, {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    const result = await response.json();

    if (!response.ok) {
      setMessage(result.message ?? "업무 목록을 불러오지 못했습니다.");
      setLoading(false);
      return;
    }

    setRows(result.rows ?? []);
    setMessage("");
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, [date]);

  const visible = useMemo(
    () => rows.filter((row) => filter === "all" || row.workflowStatus === filter),
    [rows, filter],
  );

  async function runAction(reservationId: number, action: string) {
    const accessToken = await token();
    if (!accessToken) return;

    const response = await fetch("/api/hospital/workflow/v6-2/action", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ reservationId, action }),
    });

    const result = await response.json();

    if (!response.ok) {
      if (result.code === "INVENTORY_REVIEW_REQUIRED" && result.invoiceId) {
        window.location.href = `/hospital-admin/inventory/usage-review/${result.invoiceId}`;
        return;
      }

      setMessage(result.message ?? "상태를 변경하지 못했습니다.");
      return;
    }

    await load();
  }

  return (
    <main className="p-4 lg:p-6">
      <div className="mx-auto max-w-[1500px]">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Daily Workflow
            </p>
            <h1 className="mt-1 text-2xl font-bold">오늘의 통합 업무</h1>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className="border border-slate-300 bg-white px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={() => void load()}
              className="border border-slate-900 bg-slate-900 px-4 py-2 text-sm font-bold text-white"
            >
              새로고침
            </button>
          </div>
        </div>

        {message && (
          <div className="mt-4 border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
            {message}
          </div>
        )}

        <div className="mt-4 flex gap-1 overflow-x-auto border-b border-slate-300">
          {[
            ["all", "전체"],
            ["reservation_requested", "승인 대기"],
            ["scheduled", "예약 확정"],
            ["arrived", "접수"],
            ["in_progress", "진료 중"],
            ["billing", "청구"],
            ["payment_pending", "결제 대기"],
            ["inventory_review", "재고 검토"],
            ["completed", "완료"],
          ].map(([value, label]) => (
            <button
              key={value}
              onClick={() => setFilter(value)}
              className={`whitespace-nowrap border-x border-t px-4 py-2 text-sm font-semibold ${
                filter === value
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-300 bg-white text-slate-700"
              }`}
            >
              {label}
              <span className="ml-2 text-xs opacity-70">
                {value === "all"
                  ? rows.length
                  : rows.filter((row) => row.workflowStatus === value).length}
              </span>
            </button>
          ))}
        </div>

        <section className="border border-t-0 border-slate-300 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1180px] text-left text-sm">
              <thead className="bg-slate-100 text-xs text-slate-600">
                <tr>
                  <th className="px-3 py-2">시간</th>
                  <th className="px-3 py-2">환자</th>
                  <th className="px-3 py-2">보호자</th>
                  <th className="px-3 py-2">방문 사유</th>
                  <th className="px-3 py-2">상태</th>
                  <th className="px-3 py-2">청구액</th>
                  <th className="px-3 py-2">업무 처리</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((row) => (
                  <tr key={row.reservationId} className="border-t border-slate-200 align-top hover:bg-slate-50">
                    <td className="px-3 py-3 font-mono text-xs">{row.reservationTime}</td>
                    <td className="px-3 py-3">
                      <p className="font-bold">{row.petName}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {[row.species, row.breed].filter(Boolean).join(" · ") || "-"}
                      </p>
                    </td>
                    <td className="px-3 py-3">
                      <p>{row.guardianName}</p>
                      <p className="mt-1 text-xs text-slate-500">{row.phone || "-"}</p>
                    </td>
                    <td className="max-w-[260px] px-3 py-3">
                      <p className="truncate">{row.visitReason || "-"}</p>
                      {row.symptoms && (
                        <p className="mt-1 truncate text-xs text-slate-500">{row.symptoms}</p>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <span className="inline-block border border-slate-300 bg-slate-50 px-2 py-1 text-xs font-semibold">
                        {statusLabels[row.workflowStatus] ?? row.workflowStatus}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right font-semibold">
                      {row.totalAmount == null
                        ? "-"
                        : `${Number(row.totalAmount).toLocaleString("ko-KR")}원`}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-1">
                        {row.workflowStatus === "reservation_requested" && (
                          <Action onClick={() => runAction(row.reservationId, "approve")} label="예약 승인" primary />
                        )}
                        {row.workflowStatus === "scheduled" && (
                          <Action onClick={() => runAction(row.reservationId, "arrive")} label="접수 완료" primary />
                        )}
                        {row.workflowStatus === "arrived" && (
                          <Action onClick={() => runAction(row.reservationId, "start_treatment")} label="진료 시작" primary />
                        )}
                        {row.petId && ["arrived", "in_progress", "billing", "payment_pending", "inventory_review"].includes(row.workflowStatus) && (
                          <Link
                            href={`/hospital-admin/emr/new?reservationId=${row.reservationId}&petId=${row.petId}`}
                            className="border border-blue-700 bg-blue-700 px-2 py-1.5 text-xs font-bold text-white"
                          >
                            전자차트
                          </Link>
                        )}
                        {["arrived", "in_progress"].includes(row.workflowStatus) && !row.invoiceId && (
                          <Link
                            href="/hospital-admin/billing/new"
                            className="border border-slate-400 bg-white px-2 py-1.5 text-xs font-semibold"
                          >
                            청구 작성
                          </Link>
                        )}
                        {row.invoiceId && row.workflowStatus === "inventory_review" && (
                          <Link
                            href={`/hospital-admin/inventory/usage-review/${row.invoiceId}`}
                            className="border border-amber-600 bg-amber-500 px-2 py-1.5 text-xs font-bold text-white"
                          >
                            재고 검토
                          </Link>
                        )}
                        {row.petId && (
                          <Link
                            href={`/hospital-admin/patients/${row.petId}`}
                            className="border border-slate-400 bg-white px-2 py-1.5 text-xs font-semibold"
                          >
                            환자 정보
                          </Link>
                        )}
                        {row.inventoryFinalizedAt && row.workflowStatus !== "completed" && (
                          <Action onClick={() => runAction(row.reservationId, "complete")} label="진료 완료" primary />
                        )}
                      </div>
                    </td>
                  </tr>
                ))}

                {!loading && visible.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-slate-500">
                      선택한 조건의 업무가 없습니다.
                    </td>
                  </tr>
                )}

                {loading && (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-slate-500">
                      업무 목록을 불러오는 중입니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}

function Action({
  onClick,
  label,
  primary = false,
}: {
  onClick: () => void | Promise<void>;
  label: string;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => void onClick()}
      className={`border px-2 py-1.5 text-xs font-bold ${
        primary
          ? "border-slate-900 bg-slate-900 text-white"
          : "border-slate-400 bg-white"
      }`}
    >
      {label}
    </button>
  );
}
