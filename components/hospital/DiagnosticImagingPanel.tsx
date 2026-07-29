"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { hospitalAuthFetch } from "@/lib/hospital-auth-fetch";
import { supabase } from "@/lib/supabase";

type ResultItem = {
  id?: number;
  item_name: string;
  value_text: string;
  value_number: string;
  unit: string;
  reference_min: string;
  reference_max: string;
  reference_text: string;
  abnormal_flag: string;
  note: string;
};

type DiagnosticFile = {
  id: number;
  original_filename: string;
  file_kind: string;
  mime_type: string | null;
  size_bytes: number | null;
  caption: string | null;
  is_guardian_visible: boolean;
};

type DiagnosticOrder = {
  id: number;
  category: string;
  test_code: string | null;
  test_name: string;
  body_site: string | null;
  priority: string;
  status: string;
  ordered_at: string;
  scheduled_at: string | null;
  completed_at: string | null;
  clinical_note: string | null;
  interpretation: string | null;
  internal_note: string | null;
  guardian_summary: string | null;
  is_guardian_visible: boolean;
  diagnostic_result_items: Array<{
    id: number;
    item_name: string;
    value_text: string | null;
    value_number: number | null;
    unit: string | null;
    reference_min: number | null;
    reference_max: number | null;
    reference_text: string | null;
    abnormal_flag: string | null;
    note: string | null;
  }> | null;
  diagnostic_files: DiagnosticFile[] | null;
};

const categoryOptions = [
  ["laboratory", "검사실"],
  ["xray", "X-ray"],
  ["ultrasound", "초음파"],
  ["ct", "CT"],
  ["mri", "MRI"],
  ["endoscopy", "내시경"],
  ["pathology", "병리"],
  ["other", "기타"],
] as const;

const statusOptions = [
  ["ordered", "지시"],
  ["scheduled", "예약"],
  ["collecting", "검체 채취"],
  ["in_progress", "진행 중"],
  ["completed", "완료"],
  ["cancelled", "취소"],
] as const;

const priorityOptions = [
  ["routine", "일반"],
  ["urgent", "긴급"],
  ["stat", "즉시"],
] as const;

const abnormalOptions = [
  ["", "미설정"],
  ["normal", "정상"],
  ["low", "낮음"],
  ["high", "높음"],
  ["critical_low", "위험 낮음"],
  ["critical_high", "위험 높음"],
  ["abnormal", "이상"],
] as const;

function blankResult(): ResultItem {
  return {
    item_name: "",
    value_text: "",
    value_number: "",
    unit: "",
    reference_min: "",
    reference_max: "",
    reference_text: "",
    abnormal_flag: "",
    note: "",
  };
}

function categoryLabel(value: string) {
  return categoryOptions.find(([key]) => key === value)?.[1] ?? value;
}

function statusLabel(value: string) {
  return statusOptions.find(([key]) => key === value)?.[1] ?? value;
}

function priorityLabel(value: string) {
  return priorityOptions.find(([key]) => key === value)?.[1] ?? value;
}

function formatBytes(value: number | null) {
  if (!value) return "-";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function toInputDateTime(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

export default function DiagnosticImagingPanel({
  recordId,
  patientName,
}: {
  recordId: number;
  patientName: string;
}) {
  const [orders, setOrders] = useState<DiagnosticOrder[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  const [createForm, setCreateForm] = useState({
    category: "laboratory",
    test_name: "",
    test_code: "",
    body_site: "",
    priority: "routine",
    scheduled_at: "",
    clinical_note: "",
  });

  const selected = useMemo(
    () => orders.find((item) => item.id === selectedId) ?? null,
    [orders, selectedId],
  );

  const [editForm, setEditForm] = useState({
    status: "ordered",
    priority: "routine",
    scheduled_at: "",
    clinical_note: "",
    interpretation: "",
    internal_note: "",
    guardian_summary: "",
    is_guardian_visible: false,
  });

  const [results, setResults] = useState<ResultItem[]>([blankResult()]);
  const [uploadCaption, setUploadCaption] = useState("");
  const [uploadVisible, setUploadVisible] = useState(false);

  async function load(preferredId?: number) {
    setLoading(true);
    setMessage("");

    try {
      const response = await hospitalAuthFetch(
        `/api/hospital/medical-records/${recordId}/diagnostics`,
      );
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message ?? "검사·영상 목록 조회 실패");
      }

      const nextOrders = (result.diagnostics ?? []) as DiagnosticOrder[];
      setOrders(nextOrders);

      const nextId =
        preferredId ??
        (selectedId && nextOrders.some((item) => item.id === selectedId)
          ? selectedId
          : nextOrders[0]?.id ?? null);

      setSelectedId(nextId);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "검사·영상 목록을 불러오지 못했습니다.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recordId]);

  useEffect(() => {
    if (!selected) {
      setResults([blankResult()]);
      return;
    }

    setEditForm({
      status: selected.status,
      priority: selected.priority,
      scheduled_at: toInputDateTime(selected.scheduled_at),
      clinical_note: selected.clinical_note ?? "",
      interpretation: selected.interpretation ?? "",
      internal_note: selected.internal_note ?? "",
      guardian_summary: selected.guardian_summary ?? "",
      is_guardian_visible: selected.is_guardian_visible,
    });

    const nextResults =
      selected.diagnostic_result_items?.map((item) => ({
        id: item.id,
        item_name: item.item_name,
        value_text: item.value_text ?? "",
        value_number:
          item.value_number === null ? "" : String(item.value_number),
        unit: item.unit ?? "",
        reference_min:
          item.reference_min === null ? "" : String(item.reference_min),
        reference_max:
          item.reference_max === null ? "" : String(item.reference_max),
        reference_text: item.reference_text ?? "",
        abnormal_flag: item.abnormal_flag ?? "",
        note: item.note ?? "",
      })) ?? [];

    setResults(nextResults.length > 0 ? nextResults : [blankResult()]);
  }, [selected]);

  async function createOrder() {
    if (!createForm.test_name.trim()) {
      setMessage("검사명을 입력해 주세요.");
      return;
    }

    setWorking(true);
    setMessage("");

    try {
      const response = await hospitalAuthFetch(
        `/api/hospital/medical-records/${recordId}/diagnostics`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            category: createForm.category,
            testCode: createForm.test_code || null,
            testName: createForm.test_name,
            bodySite: createForm.body_site || null,
            priority: createForm.priority,
            scheduledAt: createForm.scheduled_at
              ? new Date(createForm.scheduled_at).toISOString()
              : null,
            clinicalNote: createForm.clinical_note || null,
          }),
        },
      );

      const result = await response.json();
      if (!response.ok) throw new Error(result.message);

      setCreateForm({
        category: "laboratory",
        test_name: "",
        test_code: "",
        body_site: "",
        priority: "routine",
        scheduled_at: "",
        clinical_note: "",
      });
      setShowCreate(false);
      setMessage("검사·영상 오더를 생성했습니다.");
      await load(result.diagnostic.id);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "검사 오더 생성 실패",
      );
    } finally {
      setWorking(false);
    }
  }

  async function saveOrder() {
    if (!selected) return;

    setWorking(true);
    setMessage("");

    try {
      const response = await hospitalAuthFetch(
        `/api/hospital/diagnostics/${selected.id}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            status: editForm.status,
            priority: editForm.priority,
            scheduledAt: editForm.scheduled_at
              ? new Date(editForm.scheduled_at).toISOString()
              : null,
            clinicalNote: editForm.clinical_note,
            interpretation: editForm.interpretation,
            internalNote: editForm.internal_note,
            guardianSummary: editForm.guardian_summary,
            isGuardianVisible: editForm.is_guardian_visible,
          }),
        },
      );

      const result = await response.json();
      if (!response.ok) throw new Error(result.message);

      setMessage("검사 상태와 판독 내용을 저장했습니다.");
      await load(selected.id);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "검사 정보 저장 실패",
      );
    } finally {
      setWorking(false);
    }
  }

  async function saveResults(markCompleted = false) {
    if (!selected) return;

    const validResults = results.filter(
      (item) =>
        item.item_name.trim() ||
        item.value_text.trim() ||
        item.value_number.trim(),
    );

    if (validResults.some((item) => !item.item_name.trim())) {
      setMessage("결과값을 입력한 항목에는 항목명이 필요합니다.");
      return;
    }

    setWorking(true);
    setMessage("");

    try {
      const response = await hospitalAuthFetch(
        `/api/hospital/diagnostics/${selected.id}/results`,
        {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            items: validResults.map((item, index) => ({
              itemName: item.item_name,
              valueText: item.value_text || null,
              valueNumber: item.value_number || null,
              unit: item.unit || null,
              referenceMin: item.reference_min || null,
              referenceMax: item.reference_max || null,
              referenceText: item.reference_text || null,
              abnormalFlag: item.abnormal_flag || null,
              sortOrder: index,
              note: item.note || null,
            })),
            interpretation: editForm.interpretation,
            guardianSummary: editForm.guardian_summary,
            isGuardianVisible: editForm.is_guardian_visible,
            markCompleted,
          }),
        },
      );

      const result = await response.json();
      if (!response.ok) throw new Error(result.message);

      setMessage(
        markCompleted
          ? "검사 결과를 저장하고 완료 처리했습니다."
          : "검사 결과를 저장했습니다.",
      );
      await load(selected.id);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "검사 결과 저장 실패",
      );
    } finally {
      setWorking(false);
    }
  }

  async function deleteOrder() {
    if (!selected) return;

    const confirmed = window.confirm(
      `${selected.test_name} 검사 기록을 삭제할까요?\n결과와 첨부파일도 함께 삭제됩니다.`,
    );
    if (!confirmed) return;

    setWorking(true);

    try {
      const response = await hospitalAuthFetch(
        `/api/hospital/diagnostics/${selected.id}`,
        { method: "DELETE" },
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);

      setSelectedId(null);
      setMessage("검사 기록을 삭제했습니다.");
      await load();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "검사 삭제 실패",
      );
    } finally {
      setWorking(false);
    }
  }

  async function uploadFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!selected || !file) return;

    const fileKind = file.type.startsWith("image/")
      ? "image"
      : file.type.startsWith("video/")
        ? "video"
        : file.type === "application/pdf"
          ? "pdf"
          : file.name.toLowerCase().endsWith(".dcm")
            ? "dicom"
            : "other";

    setWorking(true);
    setMessage("");

    try {
      const signResponse = await hospitalAuthFetch(
        `/api/hospital/diagnostics/${selected.id}/files/sign-upload`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            filename: file.name,
            mimeType: file.type || "application/octet-stream",
            sizeBytes: file.size,
            fileKind,
            caption: uploadCaption || null,
            isGuardianVisible: uploadVisible,
          }),
        },
      );

      const signed = await signResponse.json();
      if (!signResponse.ok) throw new Error(signed.message);

      const { error: uploadError } = await supabase.storage
        .from("diagnostic-files")
        .uploadToSignedUrl(
          signed.upload.path,
          signed.upload.token,
          file,
          {
            contentType: file.type || "application/octet-stream",
          },
        );

      if (uploadError) throw uploadError;

      setUploadCaption("");
      setUploadVisible(false);
      setMessage("검사 파일을 업로드했습니다.");
      await load(selected.id);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "파일 업로드 실패",
      );
    } finally {
      setWorking(false);
    }
  }

  async function openFile(file: DiagnosticFile) {
    if (!selected) return;

    try {
      const response = await hospitalAuthFetch(
        `/api/hospital/diagnostics/${selected.id}/files/${file.id}`,
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);

      window.open(result.signedUrl, "_blank", "noopener,noreferrer");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "파일 열람 실패",
      );
    }
  }

  async function deleteFile(file: DiagnosticFile) {
    if (!selected) return;

    const confirmed = window.confirm(
      `${file.original_filename} 파일을 삭제할까요?`,
    );
    if (!confirmed) return;

    setWorking(true);

    try {
      const response = await hospitalAuthFetch(
        `/api/hospital/diagnostics/${selected.id}/files/${file.id}`,
        { method: "DELETE" },
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);

      setMessage("검사 파일을 삭제했습니다.");
      await load(selected.id);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "파일 삭제 실패",
      );
    } finally {
      setWorking(false);
    }
  }

  return (
    <article className="border border-slate-300 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold tracking-[0.14em] text-slate-500">
            DIAGNOSTICS & IMAGING
          </p>
          <h3 className="mt-1 text-base font-bold">검사·영상</h3>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            {patientName}의 검사 지시, 수치 결과, 판독과 파일을 한곳에서
            관리합니다.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowCreate((current) => !current)}
          className="border border-slate-950 bg-slate-950 px-4 py-2 text-sm font-bold text-white"
        >
          {showCreate ? "등록 닫기" : "+ 검사 지시"}
        </button>
      </div>

      {message && (
        <div className="mt-3 border border-blue-300 bg-blue-50 p-3 text-sm text-blue-800">
          {message}
        </div>
      )}

      {showCreate && (
        <section className="mt-4 border border-slate-300 bg-slate-50 p-4">
          <h4 className="font-bold">새 검사·영상 오더</h4>

          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <label>
              <span className="text-xs font-bold">분류</span>
              <select
                value={createForm.category}
                onChange={(event) =>
                  setCreateForm((current) => ({
                    ...current,
                    category: event.target.value,
                  }))
                }
                className="mt-1.5 w-full border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                {categoryOptions.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span className="text-xs font-bold">검사명 *</span>
              <input
                value={createForm.test_name}
                onChange={(event) =>
                  setCreateForm((current) => ({
                    ...current,
                    test_name: event.target.value,
                  }))
                }
                placeholder="예: CBC, 흉부 X-ray"
                className="mt-1.5 w-full border border-slate-300 bg-white px-3 py-2 text-sm"
              />
            </label>

            <label>
              <span className="text-xs font-bold">검사 코드</span>
              <input
                value={createForm.test_code}
                onChange={(event) =>
                  setCreateForm((current) => ({
                    ...current,
                    test_code: event.target.value,
                  }))
                }
                placeholder="선택 입력"
                className="mt-1.5 w-full border border-slate-300 bg-white px-3 py-2 text-sm"
              />
            </label>

            <label>
              <span className="text-xs font-bold">검사 부위</span>
              <input
                value={createForm.body_site}
                onChange={(event) =>
                  setCreateForm((current) => ({
                    ...current,
                    body_site: event.target.value,
                  }))
                }
                placeholder="예: 흉부, 복부"
                className="mt-1.5 w-full border border-slate-300 bg-white px-3 py-2 text-sm"
              />
            </label>

            <label>
              <span className="text-xs font-bold">우선순위</span>
              <select
                value={createForm.priority}
                onChange={(event) =>
                  setCreateForm((current) => ({
                    ...current,
                    priority: event.target.value,
                  }))
                }
                className="mt-1.5 w-full border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                {priorityOptions.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span className="text-xs font-bold">예정 시각</span>
              <input
                type="datetime-local"
                value={createForm.scheduled_at}
                onChange={(event) =>
                  setCreateForm((current) => ({
                    ...current,
                    scheduled_at: event.target.value,
                  }))
                }
                className="mt-1.5 w-full border border-slate-300 bg-white px-3 py-2 text-sm"
              />
            </label>

            <label className="md:col-span-3">
              <span className="text-xs font-bold">검사 목적·임상 메모</span>
              <textarea
                rows={2}
                value={createForm.clinical_note}
                onChange={(event) =>
                  setCreateForm((current) => ({
                    ...current,
                    clinical_note: event.target.value,
                  }))
                }
                className="mt-1.5 w-full border border-slate-300 bg-white px-3 py-2 text-sm"
              />
            </label>
          </div>

          <button
            type="button"
            disabled={working}
            onClick={() => void createOrder()}
            className="mt-3 bg-slate-950 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
          >
            검사 오더 생성
          </button>
        </section>
      )}

      <section className="mt-4 grid gap-3 xl:grid-cols-[300px_1fr]">
        <aside className="max-h-[680px] overflow-y-auto border border-slate-300">
          <div className="border-b border-slate-300 bg-slate-50 px-3 py-2 text-xs font-bold">
            검사 목록 {orders.length}건
          </div>

          {loading ? (
            <p className="p-4 text-sm text-slate-500">불러오는 중...</p>
          ) : orders.length === 0 ? (
            <p className="p-4 text-sm leading-6 text-slate-500">
              등록된 검사·영상 오더가 없습니다.
            </p>
          ) : (
            orders.map((order) => (
              <button
                key={order.id}
                type="button"
                onClick={() => setSelectedId(order.id)}
                className={`block w-full border-b border-slate-200 p-3 text-left ${
                  selectedId === order.id
                    ? "bg-slate-950 text-white"
                    : "bg-white hover:bg-slate-50"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold">
                    {categoryLabel(order.category)}
                  </span>
                  <span className="text-[11px]">
                    {statusLabel(order.status)}
                  </span>
                </div>
                <p className="mt-1 font-bold">{order.test_name}</p>
                <p
                  className={`mt-1 text-xs ${
                    selectedId === order.id
                      ? "text-white/60"
                      : "text-slate-500"
                  }`}
                >
                  {priorityLabel(order.priority)} ·{" "}
                  {new Date(order.ordered_at).toLocaleString("ko-KR")}
                </p>
              </button>
            ))
          )}
        </aside>

        {!selected ? (
          <div className="flex min-h-64 items-center justify-center border border-slate-300 bg-slate-50 p-8 text-sm text-slate-500">
            검사 기록을 선택하거나 새 검사를 지시해 주세요.
          </div>
        ) : (
          <section className="space-y-3">
            <div className="border border-slate-300 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold text-slate-500">
                    {categoryLabel(selected.category)}
                  </p>
                  <h4 className="mt-1 text-lg font-bold">
                    {selected.test_name}
                  </h4>
                  <p className="mt-1 text-xs text-slate-500">
                    #{selected.id}
                    {selected.body_site ? ` · ${selected.body_site}` : ""}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={working}
                  onClick={() => void deleteOrder()}
                  className="border border-red-300 px-3 py-2 text-xs font-bold text-red-700"
                >
                  검사 삭제
                </button>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <label>
                  <span className="text-xs font-bold">상태</span>
                  <select
                    value={editForm.status}
                    onChange={(event) =>
                      setEditForm((current) => ({
                        ...current,
                        status: event.target.value,
                      }))
                    }
                    className="mt-1.5 w-full border border-slate-300 px-3 py-2 text-sm"
                  >
                    {statusOptions.map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  <span className="text-xs font-bold">우선순위</span>
                  <select
                    value={editForm.priority}
                    onChange={(event) =>
                      setEditForm((current) => ({
                        ...current,
                        priority: event.target.value,
                      }))
                    }
                    className="mt-1.5 w-full border border-slate-300 px-3 py-2 text-sm"
                  >
                    {priorityOptions.map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  <span className="text-xs font-bold">예정 시각</span>
                  <input
                    type="datetime-local"
                    value={editForm.scheduled_at}
                    onChange={(event) =>
                      setEditForm((current) => ({
                        ...current,
                        scheduled_at: event.target.value,
                      }))
                    }
                    className="mt-1.5 w-full border border-slate-300 px-3 py-2 text-sm"
                  />
                </label>

                <label className="md:col-span-3">
                  <span className="text-xs font-bold">검사 목적·임상 메모</span>
                  <textarea
                    rows={2}
                    value={editForm.clinical_note}
                    onChange={(event) =>
                      setEditForm((current) => ({
                        ...current,
                        clinical_note: event.target.value,
                      }))
                    }
                    className="mt-1.5 w-full border border-slate-300 px-3 py-2 text-sm"
                  />
                </label>

                <label className="md:col-span-2">
                  <span className="text-xs font-bold">수의사 판독 소견</span>
                  <textarea
                    rows={3}
                    value={editForm.interpretation}
                    onChange={(event) =>
                      setEditForm((current) => ({
                        ...current,
                        interpretation: event.target.value,
                      }))
                    }
                    className="mt-1.5 w-full border border-slate-300 px-3 py-2 text-sm"
                  />
                </label>

                <label>
                  <span className="text-xs font-bold">병원 내부 메모</span>
                  <textarea
                    rows={3}
                    value={editForm.internal_note}
                    onChange={(event) =>
                      setEditForm((current) => ({
                        ...current,
                        internal_note: event.target.value,
                      }))
                    }
                    className="mt-1.5 w-full border border-slate-300 px-3 py-2 text-sm"
                  />
                </label>
              </div>

              <button
                type="button"
                disabled={working}
                onClick={() => void saveOrder()}
                className="mt-3 border border-slate-950 px-4 py-2 text-sm font-bold disabled:opacity-50"
              >
                상태·판독 저장
              </button>
            </div>

            <div className="border border-slate-300 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h4 className="font-bold">검사 결과 항목</h4>
                  <p className="mt-1 text-xs text-slate-500">
                    혈액검사 수치처럼 여러 항목을 행 단위로 입력합니다.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setResults((current) => [...current, blankResult()])
                  }
                  className="border border-slate-300 px-3 py-2 text-xs font-bold"
                >
                  + 결과 행
                </button>
              </div>

              <div className="mt-3 space-y-3">
                {results.map((item, index) => (
                  <div
                    key={`${item.id ?? "new"}-${index}`}
                    className="border border-slate-200 bg-slate-50 p-3"
                  >
                    <div className="grid gap-2 md:grid-cols-4">
                      <label>
                        <span className="text-[11px] font-bold">항목명</span>
                        <input
                          value={item.item_name}
                          onChange={(event) =>
                            setResults((current) =>
                              current.map((row, rowIndex) =>
                                rowIndex === index
                                  ? { ...row, item_name: event.target.value }
                                  : row,
                              ),
                            )
                          }
                          placeholder="예: WBC"
                          className="mt-1 w-full border border-slate-300 bg-white px-2 py-2 text-sm"
                        />
                      </label>

                      <label>
                        <span className="text-[11px] font-bold">숫자 결과</span>
                        <input
                          inputMode="decimal"
                          value={item.value_number}
                          onChange={(event) =>
                            setResults((current) =>
                              current.map((row, rowIndex) =>
                                rowIndex === index
                                  ? { ...row, value_number: event.target.value }
                                  : row,
                              ),
                            )
                          }
                          className="mt-1 w-full border border-slate-300 bg-white px-2 py-2 text-sm"
                        />
                      </label>

                      <label>
                        <span className="text-[11px] font-bold">문자 결과</span>
                        <input
                          value={item.value_text}
                          onChange={(event) =>
                            setResults((current) =>
                              current.map((row, rowIndex) =>
                                rowIndex === index
                                  ? { ...row, value_text: event.target.value }
                                  : row,
                              ),
                            )
                          }
                          placeholder="예: 음성"
                          className="mt-1 w-full border border-slate-300 bg-white px-2 py-2 text-sm"
                        />
                      </label>

                      <label>
                        <span className="text-[11px] font-bold">단위</span>
                        <input
                          value={item.unit}
                          onChange={(event) =>
                            setResults((current) =>
                              current.map((row, rowIndex) =>
                                rowIndex === index
                                  ? { ...row, unit: event.target.value }
                                  : row,
                              ),
                            )
                          }
                          className="mt-1 w-full border border-slate-300 bg-white px-2 py-2 text-sm"
                        />
                      </label>

                      <label>
                        <span className="text-[11px] font-bold">정상 최소</span>
                        <input
                          inputMode="decimal"
                          value={item.reference_min}
                          onChange={(event) =>
                            setResults((current) =>
                              current.map((row, rowIndex) =>
                                rowIndex === index
                                  ? {
                                      ...row,
                                      reference_min: event.target.value,
                                    }
                                  : row,
                              ),
                            )
                          }
                          className="mt-1 w-full border border-slate-300 bg-white px-2 py-2 text-sm"
                        />
                      </label>

                      <label>
                        <span className="text-[11px] font-bold">정상 최대</span>
                        <input
                          inputMode="decimal"
                          value={item.reference_max}
                          onChange={(event) =>
                            setResults((current) =>
                              current.map((row, rowIndex) =>
                                rowIndex === index
                                  ? {
                                      ...row,
                                      reference_max: event.target.value,
                                    }
                                  : row,
                              ),
                            )
                          }
                          className="mt-1 w-full border border-slate-300 bg-white px-2 py-2 text-sm"
                        />
                      </label>

                      <label>
                        <span className="text-[11px] font-bold">참고 범위 설명</span>
                        <input
                          value={item.reference_text}
                          onChange={(event) =>
                            setResults((current) =>
                              current.map((row, rowIndex) =>
                                rowIndex === index
                                  ? {
                                      ...row,
                                      reference_text: event.target.value,
                                    }
                                  : row,
                              ),
                            )
                          }
                          placeholder="예: 음성"
                          className="mt-1 w-full border border-slate-300 bg-white px-2 py-2 text-sm"
                        />
                      </label>

                      <label>
                        <span className="text-[11px] font-bold">판정</span>
                        <select
                          value={item.abnormal_flag}
                          onChange={(event) =>
                            setResults((current) =>
                              current.map((row, rowIndex) =>
                                rowIndex === index
                                  ? {
                                      ...row,
                                      abnormal_flag: event.target.value,
                                    }
                                  : row,
                              ),
                            )
                          }
                          className="mt-1 w-full border border-slate-300 bg-white px-2 py-2 text-sm"
                        >
                          {abnormalOptions.map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>

                    <div className="mt-2 flex gap-2">
                      <input
                        value={item.note}
                        onChange={(event) =>
                          setResults((current) =>
                            current.map((row, rowIndex) =>
                              rowIndex === index
                                ? { ...row, note: event.target.value }
                                : row,
                            ),
                          )
                        }
                        placeholder="항목 비고"
                        className="min-w-0 flex-1 border border-slate-300 bg-white px-2 py-2 text-sm"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setResults((current) => {
                            const next = current.filter(
                              (_, rowIndex) => rowIndex !== index,
                            );
                            return next.length > 0 ? next : [blankResult()];
                          })
                        }
                        className="border border-red-200 px-3 text-xs font-bold text-red-700"
                      >
                        행 삭제
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <label className="md:col-span-2">
                  <span className="text-xs font-bold">보호자용 결과 설명</span>
                  <textarea
                    rows={3}
                    value={editForm.guardian_summary}
                    onChange={(event) =>
                      setEditForm((current) => ({
                        ...current,
                        guardian_summary: event.target.value,
                      }))
                    }
                    placeholder="보호자가 이해하기 쉬운 표현으로 작성해 주세요."
                    className="mt-1.5 w-full border border-slate-300 px-3 py-2 text-sm"
                  />
                </label>

                <label className="flex items-center gap-2 border border-emerald-300 bg-emerald-50 p-3 text-sm font-bold">
                  <input
                    type="checkbox"
                    checked={editForm.is_guardian_visible}
                    onChange={(event) =>
                      setEditForm((current) => ({
                        ...current,
                        is_guardian_visible: event.target.checked,
                      }))
                    }
                  />
                  보호자 앱에 이 검사 결과 공개
                </label>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={working}
                  onClick={() => void saveResults(false)}
                  className="border border-slate-950 px-4 py-2.5 text-sm font-bold disabled:opacity-50"
                >
                  결과 저장
                </button>
                <button
                  type="button"
                  disabled={working}
                  onClick={() => void saveResults(true)}
                  className="bg-slate-950 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
                >
                  결과 저장·검사 완료
                </button>
              </div>
            </div>

            <div className="border border-slate-300 p-4">
              <h4 className="font-bold">영상·파일 첨부</h4>
              <p className="mt-1 text-xs text-slate-500">
                이미지, PDF, DICOM, MP4 파일을 최대 50MB까지 첨부합니다.
              </p>

              <div className="mt-3 grid gap-2 md:grid-cols-[1fr_auto_auto]">
                <input
                  value={uploadCaption}
                  onChange={(event) => setUploadCaption(event.target.value)}
                  placeholder="파일 설명"
                  className="border border-slate-300 px-3 py-2 text-sm"
                />
                <label className="flex items-center gap-2 border border-slate-300 px-3 py-2 text-xs font-bold">
                  <input
                    type="checkbox"
                    checked={uploadVisible}
                    onChange={(event) =>
                      setUploadVisible(event.target.checked)
                    }
                  />
                  보호자 공개
                </label>
                <label className="cursor-pointer bg-slate-950 px-4 py-2.5 text-center text-sm font-bold text-white">
                  파일 선택
                  <input
                    type="file"
                    accept="image/*,application/pdf,video/mp4,.dcm,application/dicom"
                    onChange={(event) => void uploadFile(event)}
                    className="hidden"
                  />
                </label>
              </div>

              <div className="mt-3 space-y-2">
                {(selected.diagnostic_files ?? []).length === 0 ? (
                  <div className="border border-dashed border-slate-300 p-5 text-center text-sm text-slate-500">
                    첨부된 검사 파일이 없습니다.
                  </div>
                ) : (
                  (selected.diagnostic_files ?? []).map((file) => (
                    <div
                      key={file.id}
                      className="flex flex-wrap items-center justify-between gap-3 border border-slate-200 p-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold">
                          {file.original_filename}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {file.file_kind} · {formatBytes(file.size_bytes)}
                          {file.is_guardian_visible ? " · 보호자 공개" : ""}
                        </p>
                        {file.caption && (
                          <p className="mt-1 text-xs text-slate-600">
                            {file.caption}
                          </p>
                        )}
                      </div>

                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => void openFile(file)}
                          className="border border-slate-300 px-3 py-2 text-xs font-bold"
                        >
                          열기
                        </button>
                        <button
                          type="button"
                          disabled={working}
                          onClick={() => void deleteFile(file)}
                          className="border border-red-200 px-3 py-2 text-xs font-bold text-red-700"
                        >
                          삭제
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>
        )}
      </section>
    </article>
  );
}
