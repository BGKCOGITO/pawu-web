"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "../../../../lib/supabase";

function one(value: any) {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

export default function DispensingDetailPage() {
  const params = useParams<{ jobId: string }>();
  const [job, setJob] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [completionNote, setCompletionNote] = useState("");
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  async function token() {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? "";
  }

  async function load() {
    const accessToken = await token();
    const response = await fetch(
      `/api/hospital/dispensing/${params.jobId}`,
      { headers: { authorization: `Bearer ${accessToken}` } },
    );
    const result = await response.json();

    if (!response.ok) {
      setMessage(result.message ?? "조제 작업을 불러오지 못했습니다.");
      return;
    }

    setJob(result.job);
    setItems(
      (result.job.dispensing_items ?? []).map((item: any) => ({
        id: item.id,
        dispensedQuantity: String(
          item.dispensed_quantity ?? item.requested_quantity ?? "",
        ),
        lotId: item.lot_id ? String(item.lot_id) : "",
      })),
    );
  }

  useEffect(() => {
    void load();
  }, [params.jobId]);

  async function action(name: "start" | "complete" | "cancel") {
    if (saving) return;
    setSaving(true);

    const accessToken = await token();
    const response = await fetch(
      `/api/hospital/dispensing/${params.jobId}`,
      {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          action: name,
          completionNote,
          reason,
          items: items.map((item) => ({
            id: item.id,
            dispensedQuantity: Number(item.dispensedQuantity),
            lotId: item.lotId ? Number(item.lotId) : null,
          })),
        }),
      },
    );

    const result = await response.json();
    setSaving(false);

    if (!response.ok) {
      setMessage(result.message ?? "처리하지 못했습니다.");
      return;
    }

    setMessage(
      name === "complete"
        ? "조제와 재고 차감을 완료했습니다."
        : name === "start"
          ? "조제를 시작했습니다."
          : "조제 작업을 취소했습니다.",
    );
    await load();
  }

  if (!job) {
    return (
      <main className="p-8 text-center text-sm text-slate-500">
        {message || "조제 작업을 불러오는 중입니다."}
      </main>
    );
  }

  const pet = one(job.pets);
  const order = one(job.medication_orders);
  const readonly = ["completed", "cancelled"].includes(job.status);

  return (
    <main className="px-4 py-5 text-slate-950 sm:px-6">
      <div className="mx-auto max-w-[1500px]">
        <header className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-300 pb-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">
              Dispensing Order
            </p>
            <h1 className="mt-1 text-2xl font-black">
              {pet?.name ?? "환자"} 조제
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              처방 #{job.medication_order_id} · 조제 #{job.id}
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              href={`/hospital-admin/prescriptions/${job.medication_order_id}`}
              className="border border-slate-400 bg-white px-4 py-2 text-sm font-semibold"
            >
              원 처방전
            </Link>
            <Link
              href="/hospital-admin/dispensing"
              className="border border-slate-400 bg-white px-4 py-2 text-sm font-semibold"
            >
              조제 목록
            </Link>
          </div>
        </header>

        {message && (
          <div className="mt-3 border border-blue-300 bg-blue-50 px-4 py-3 text-sm text-blue-900">
            {message}
          </div>
        )}

        <section className="mt-4 grid gap-3 md:grid-cols-4">
          <Info label="환자" value={pet?.name ?? "-"} />
          <Info
            label="체중"
            value={pet?.weight_kg != null ? `${pet.weight_kg} kg` : "미등록"}
            alert={pet?.weight_kg == null}
          />
          <Info label="처방 목적" value={order?.diagnosis_summary || "-"} />
          <Info label="조제 상태" value={job.status} />
        </section>

        <section className="mt-4 border border-slate-300 bg-white">
          <div className="border-b border-slate-300 bg-slate-100 px-4 py-3">
            <h2 className="text-sm font-bold">조제 품목</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1150px] text-left text-sm">
              <thead className="bg-slate-50 text-xs text-slate-600">
                <tr>
                  <th className="px-4 py-3">약품</th>
                  <th className="px-4 py-3">처방 수량</th>
                  <th className="px-4 py-3">현재 재고</th>
                  <th className="px-4 py-3">조제 수량</th>
                  <th className="px-4 py-3">LOT</th>
                  <th className="px-4 py-3">유효기간</th>
                  <th className="px-4 py-3">확인</th>
                </tr>
              </thead>
              <tbody>
                {(job.dispensing_items ?? []).map((row: any) => {
                  const edit = items.find((item) => item.id === row.id);
                  const inventory = one(row.inventory_items);
                  const lot = one(row.inventory_lots);
                  const enough =
                    row.inventory_item_id &&
                    Number(inventory?.current_quantity ?? 0) >=
                      Number(edit?.dispensedQuantity ?? row.requested_quantity ?? 0);

                  return (
                    <tr key={row.id} className="border-t border-slate-200">
                      <td className="px-4 py-3">
                        <p className="font-black">{row.medication_name}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {inventory?.storage_location || "보관 위치 미등록"}
                        </p>
                      </td>
                      <td className="px-4 py-3 font-semibold">
                        {row.requested_quantity ?? "-"} {row.quantity_unit}
                      </td>
                      <td className="px-4 py-3">
                        {row.inventory_item_id
                          ? `${inventory?.current_quantity ?? 0} ${
                              inventory?.unit ?? ""
                            }`
                          : "재고 미연결"}
                      </td>
                      <td className="px-4 py-3">
                        <input
                          disabled={readonly}
                          value={edit?.dispensedQuantity ?? ""}
                          onChange={(event) =>
                            setItems((current) =>
                              current.map((item) =>
                                item.id === row.id
                                  ? {
                                      ...item,
                                      dispensedQuantity: event.target.value,
                                    }
                                  : item,
                              ),
                            )
                          }
                          inputMode="decimal"
                          className="w-28 border border-slate-300 px-3 py-2 disabled:bg-slate-100"
                        />
                        <span className="ml-2 text-xs">{row.quantity_unit}</span>
                      </td>
                      <td className="px-4 py-3">
                        <input
                          disabled={readonly}
                          value={edit?.lotId ?? ""}
                          onChange={(event) =>
                            setItems((current) =>
                              current.map((item) =>
                                item.id === row.id
                                  ? { ...item, lotId: event.target.value }
                                  : item,
                              ),
                            )
                          }
                          placeholder="LOT ID"
                          className="w-28 border border-slate-300 px-3 py-2 disabled:bg-slate-100"
                        />
                        {lot?.lot_number && (
                          <p className="mt-1 text-xs text-slate-500">
                            {lot.lot_number}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {lot?.expires_on || "-"}
                      </td>
                      <td className="px-4 py-3">
                        {enough ? (
                          <span className="border border-green-300 bg-green-50 px-2 py-1 text-xs font-bold text-green-700">
                            가능
                          </span>
                        ) : (
                          <span className="border border-red-300 bg-red-50 px-2 py-1 text-xs font-bold text-red-700">
                            확인 필요
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-4 grid gap-4 xl:grid-cols-[1fr_360px]">
          <div className="border border-slate-300 bg-white p-4">
            <p className="text-xs font-bold text-slate-500">보호자 복약 안내</p>
            <p className="mt-2 min-h-24 whitespace-pre-wrap text-sm leading-6">
              {job.guardian_instruction_snapshot ||
                order?.guardian_note ||
                "등록된 복약 안내가 없습니다."}
            </p>
            <button
              type="button"
              onClick={() => window.print()}
              className="mt-4 border border-slate-400 bg-white px-4 py-2 text-sm font-bold"
            >
              복약 안내 출력
            </button>
          </div>

          <div className="border border-slate-300 bg-white p-4">
            <p className="text-sm font-bold">조제 처리</p>
            {!readonly && (
              <>
                <textarea
                  value={completionNote}
                  onChange={(event) => setCompletionNote(event.target.value)}
                  placeholder="조제 메모"
                  className="mt-3 w-full border border-slate-300 px-3 py-2 text-sm"
                  rows={3}
                />
                {job.status === "queued" && (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void action("start")}
                    className="mt-3 w-full border border-blue-700 bg-blue-700 px-4 py-2 text-sm font-bold text-white"
                  >
                    조제 시작
                  </button>
                )}
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void action("complete")}
                  className="mt-2 w-full border border-green-700 bg-green-700 px-4 py-2 text-sm font-bold text-white"
                >
                  조제 완료 및 재고 차감
                </button>
                <textarea
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="취소 사유"
                  className="mt-4 w-full border border-slate-300 px-3 py-2 text-sm"
                  rows={2}
                />
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void action("cancel")}
                  className="mt-2 w-full border border-red-300 bg-white px-4 py-2 text-sm font-bold text-red-700"
                >
                  조제 취소
                </button>
              </>
            )}
            {readonly && (
              <p className="mt-3 border border-slate-300 bg-slate-50 p-3 text-sm">
                이 작업은 {job.status} 상태입니다.
              </p>
            )}
          </div>
        </section>

        <section className="mt-4 border border-amber-300 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
          <strong>안전 확인</strong>
          <p className="mt-1">
            조제 완료 시 연결된 재고가 즉시 차감됩니다. 재고 미연결,
            부족 재고, 유효하지 않은 LOT 또는 0 이하 수량이 있으면 완료가
            차단됩니다. PAWU는 처방 용량을 추천하지 않습니다.
          </p>
        </section>
      </div>
    </main>
  );
}

function Info({
  label,
  value,
  alert = false,
}: {
  label: string;
  value: string;
  alert?: boolean;
}) {
  return (
    <div className="border border-slate-300 bg-white px-4 py-3">
      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
        {label}
      </p>
      <p className={`mt-1 text-sm font-bold ${alert ? "text-red-700" : ""}`}>
        {value}
      </p>
    </div>
  );
}
