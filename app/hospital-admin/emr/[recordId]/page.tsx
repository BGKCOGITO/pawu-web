"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { hospitalAuthFetch } from "@/lib/hospital-auth-fetch";
import DiagnosticImagingPanel from "@/components/hospital/DiagnosticImagingPanel";
import AiMedicalAssistantPanel from "@/components/hospital/emr/AiMedicalAssistantPanel";
import AiPetMemoryPanel from "@/components/hospital/emr/AiPetMemoryPanel";

function one(value: any) {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

const fields = [
  ["chief_complaint", "주호소", "보호자가 가장 걱정하는 증상"],
  ["subjective", "S · Subjective", "보호자 진술과 병력"],
  ["objective", "O · Objective", "신체검사, 활력징후, 객관적 소견"],
  ["assessment", "A · Assessment", "수의사의 평가와 감별"],
  ["plan", "P · Plan", "검사, 치료, 향후 계획"],
  ["diagnosis", "진단", "수의사가 확정한 진단"],
  ["treatment", "처치", "병원에서 시행한 처치"],
  ["follow_up", "추적관리", "재진 시점과 보호자 관리사항"],
  ["veterinarian_note", "수의사 메모", "병원 내부 메모"],
] as const;

export default function EmrEditorPage() {
  const params = useParams<{ recordId: string }>();
  const [record, setRecord] = useState<any>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [prescription, setPrescription] = useState({
    medication_name: "",
    dosage: "",
    frequency: "",
    duration: "",
    route: "",
    instructions: "",
    start_date: "",
    end_date: "",
    scheduled_times_text: "",
  });
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingPrescriptionId, setDeletingPrescriptionId] =
    useState<number | null>(null);

  async function load() {
    try {
      const response = await hospitalAuthFetch(`/api/hospital/medical-records/${params.recordId}`);
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      setRecord(result.record);
      const next: Record<string, string> = {};
      for (const [key] of fields) next[key] = result.record[key] ?? "";
      next.guardian_summary = result.record.guardian_summary ?? "";
      next.care_instructions = result.record.care_instructions ?? "";
      next.medication_instructions =
        result.record.medication_instructions ?? "";
      next.next_visit_date = result.record.next_visit_date ?? "";
      setForm(next);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "차트 조회 실패");
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.recordId]);

  const parsed = useMemo(() => {
    if (!record) return null;
    const patient = one(record.hospital_patients);
    const pet = one(patient?.pets);
    const reservation = one(record.reservations);
    const preparation = one(reservation?.visit_preparations);
    const events = (preparation?.visit_preparation_events ?? [])
      .map((row: any) => one(row.pet_health_events))
      .filter(Boolean)
      .sort((a: any, b: any) => new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime());
    return { patient, pet, reservation, preparation, events };
  }, [record]);

  async function save(status = record?.status ?? "draft") {
    setSaving(true);
    setMessage("");
    try {
      const response = await hospitalAuthFetch(`/api/hospital/medical-records/${params.recordId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...form, status }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      setMessage(
        status === "completed"
          ? "진료 완료로 저장했습니다. 연결된 예약과 환자 방문기록도 함께 갱신했습니다."
          : "차트를 임시 저장했습니다.",
      );
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "저장 실패");
    } finally {
      setSaving(false);
    }
  }

  async function addPrescription() {
    try {
      const response = await hospitalAuthFetch(
        `/api/hospital/medical-records/${params.recordId}/prescriptions`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            ...prescription,
            scheduled_times: prescription.scheduled_times_text
              .split(",")
              .map((time) => time.trim())
              .filter(Boolean),
          }),
        },
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      setPrescription({
        medication_name: "",
        dosage: "",
        frequency: "",
        duration: "",
        route: "",
        instructions: "",
        start_date: "",
        end_date: "",
        scheduled_times_text: "",
      });
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "처방 추가 실패");
    }
  }

  async function deletePrescription(
    prescriptionId: number,
    medicationName: string,
  ) {
    const confirmed = window.confirm(
      `${medicationName} 처방을 삭제할까요?\n\n보호자 앱의 처방약, 복약 일정, 복용 기록에서도 함께 삭제됩니다.`,
    );

    if (!confirmed) return;

    setDeletingPrescriptionId(prescriptionId);
    setMessage("");

    try {
      const response = await hospitalAuthFetch(
        `/api/hospital/medical-records/${params.recordId}/prescriptions/${prescriptionId}`,
        { method: "DELETE" },
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);

      setMessage(
        "처방을 삭제했습니다. 보호자 앱과 복약 관리에도 함께 반영됩니다.",
      );
      await load();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "처방 삭제에 실패했습니다.",
      );
    } finally {
      setDeletingPrescriptionId(null);
    }
  }

  if (!record || !parsed) {
    return (
      <main className="p-6">
        <div className="border border-slate-300 bg-white p-10 text-center">
          {message || "전자차트를 불러오는 중입니다."}
        </div>
      </main>
    );
  }

  const { patient, pet, reservation, preparation, events } = parsed;

  return (
    <main className="p-3 lg:p-4">
      <div className="mx-auto max-w-[1800px]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link href="/hospital-admin/medical-records" className="text-sm font-bold text-slate-500">
              ← 진료 기록
            </Link>
            <h2 className="mt-2 text-xl font-bold">
              전자차트 · {pet?.name}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              환자번호 {patient?.patient_number} · 예약 #{record.reservation_id}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/hospital-admin/emr/${params.recordId}/print`}
              target="_blank"
              className="border border-slate-950 bg-white px-4 py-2 text-sm font-bold"
            >
              진료기록 인쇄·PDF
            </Link>
            <span className="border border-slate-300 bg-white px-4 py-2 text-sm font-bold">
              {record.status}
            </span>
          </div>
        </div>

        {message && (
          <div className="mt-4 border border-blue-300 bg-blue-50 p-4 text-sm text-blue-800">
            {message}
          </div>
        )}

        <section className="mt-3 grid gap-3 xl:grid-cols-[0.62fr_1.38fr]">
          <aside className="space-y-3">
            <article className="border border-slate-300 bg-white p-4">
              <h3 className="text-base font-bold">환자·보호자</h3>
              <dl className="mt-3 grid gap-x-4 gap-y-2 text-xs sm:grid-cols-2">
                <div><dt className="text-slate-400">환자</dt><dd className="font-bold">{pet?.name}</dd></div>
                <div><dt className="text-slate-400">품종</dt><dd className="font-bold">{pet?.breed || "-"}</dd></div>
                <div><dt className="text-slate-400">보호자</dt><dd className="font-bold">{reservation?.guardian_name}</dd></div>
                <div><dt className="text-slate-400">연락처</dt><dd className="font-bold">{reservation?.phone}</dd></div>
              </dl>
            </article>

            <article className="border border-slate-950 bg-slate-950 p-4 text-white">
              <p className="text-xs font-bold text-white/50">AI REFERENCE · 참고자료</p>
              <h3 className="mt-2 text-lg font-bold">PAWU 사전 요약</h3>
              <p className="mt-3 max-h-32 overflow-y-auto whitespace-pre-wrap text-xs leading-6 text-white/85">
                {record.ai_reference_summary || "생성된 요약 없음"}
              </p>
              <p className="mt-3 border-t border-white/15 pt-3 text-[11px] leading-5 text-white/50">
                이 내용은 보호자 기록과 규칙 기반 요약이며 수의사 확정 의료기록이 아닙니다.
              </p>
            </article>

            <article className="border border-slate-300 bg-white p-4">
              <h3 className="text-base font-bold">보호자 건강 이벤트</h3>
              <div className="mt-3 max-h-56 space-y-2 overflow-y-auto pr-1">
                {events.length === 0 ? (
                  <p className="text-sm text-slate-500">선택된 이벤트가 없습니다.</p>
                ) : (
                  events.map((event: any) => (
                    <div key={event.id} className="border-l-2 border-slate-950 pl-3">
                      <p className="text-xs text-slate-500">
                        {new Date(event.occurred_at).toLocaleString("ko-KR")}
                      </p>
                      <p className="mt-0.5 text-sm font-bold">{event.title}</p>
                      {event.note && <p className="mt-0.5 text-xs leading-5 text-slate-600">{event.note}</p>}
                    </div>
                  ))
                )}
              </div>
            </article>
          </aside>

          <section className="space-y-3">
            <article className="border border-slate-300 bg-white p-4">
              <div className="grid gap-3 lg:grid-cols-2">
                {fields.map(([key, label, placeholder]) => {
                  const fullWidth = [
                    "chief_complaint",
                    "diagnosis",
                    "veterinarian_note",
                  ].includes(key);

                  return (
                    <label
                      key={key}
                      className={fullWidth ? "lg:col-span-2" : ""}
                    >
                      <span className="text-sm font-bold">{label}</span>
                      <textarea
                        value={form[key] ?? ""}
                        onChange={(e) =>
                          setForm((current) => ({
                            ...current,
                            [key]: e.target.value,
                          }))
                        }
                        rows={
                          key === "chief_complaint" || key === "diagnosis"
                            ? 2
                            : key === "veterinarian_note"
                              ? 3
                              : 3
                        }
                        placeholder={placeholder}
                        className="mt-1.5 w-full resize-y border border-slate-300 px-3 py-2 text-sm leading-6"
                      />
                    </label>
                  );
                })}
              </div>
            </article>


            <DiagnosticImagingPanel
              recordId={Number(params.recordId)}
              patientName={pet?.name ?? "환자"}
            />

            <AiPetMemoryPanel recordId={Number(params.recordId)} />

            <AiMedicalAssistantPanel
              recordId={Number(params.recordId)}
              onApproved={load}
            />

            <article className="border border-emerald-300 bg-emerald-50/40 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold text-emerald-700">
                    GUARDIAN DISCHARGE GUIDE
                  </p>
                  <h3 className="mt-1 text-base font-bold">
                    보호자용 진료 결과 안내
                  </h3>
                  <p className="mt-1 text-xs leading-5 text-slate-600">
                    아래 내용은 진료 완료 후 보호자 앱에 그대로 공개됩니다.
                    병원 내부 메모는 공개되지 않습니다.
                  </p>
                </div>
                <span className="border border-emerald-300 bg-white px-2 py-1 text-xs font-bold text-emerald-800">
                  보호자 공개
                </span>
              </div>

              <div className="mt-4 grid gap-3 lg:grid-cols-2">
                <label className="lg:col-span-2">
                  <span className="text-sm font-bold">오늘 진료 요약</span>
                  <textarea
                    value={form.guardian_summary ?? ""}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        guardian_summary: event.target.value,
                      }))
                    }
                    rows={3}
                    placeholder="보호자가 이해하기 쉬운 표현으로 오늘 진료 결과를 정리해 주세요."
                    className="mt-1.5 w-full resize-y border border-slate-300 bg-white px-3 py-2 text-sm leading-6"
                  />
                </label>

                <label>
                  <span className="text-sm font-bold">보호자 주의사항</span>
                  <textarea
                    value={form.care_instructions ?? ""}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        care_instructions: event.target.value,
                      }))
                    }
                    rows={3}
                    placeholder="식이, 활동, 목욕, 증상 악화 시 대응 등을 입력해 주세요."
                    className="mt-1.5 w-full resize-y border border-slate-300 bg-white px-3 py-2 text-sm leading-6"
                  />
                </label>

                <label>
                  <span className="text-sm font-bold">공통 투약 안내</span>
                  <textarea
                    value={form.medication_instructions ?? ""}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        medication_instructions: event.target.value,
                      }))
                    }
                    rows={3}
                    placeholder="모든 처방약에 공통으로 적용할 복약 안내를 입력해 주세요."
                    className="mt-1.5 w-full resize-y border border-slate-300 bg-white px-3 py-2 text-sm leading-6"
                  />
                </label>

                <label>
                  <span className="text-sm font-bold">다음 방문 권장일</span>
                  <input
                    type="date"
                    value={form.next_visit_date ?? ""}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        next_visit_date: event.target.value,
                      }))
                    }
                    className="mt-1.5 w-full border border-slate-300 bg-white px-3 py-2 text-sm"
                  />
                </label>

                <div className="border border-dashed border-emerald-300 bg-white p-3 text-xs leading-5 text-slate-600">
                  진단명은 차트의 <strong>진단</strong>, 처방약은 아래
                  <strong> 처방</strong> 목록에서 자동으로 보호자 앱에 연결됩니다.
                </div>
              </div>
            </article>

            <article className="border border-slate-300 bg-white p-4">
              <h3 className="text-base font-bold">처방</h3>

              <div className="mt-3 max-h-56 space-y-2 overflow-y-auto pr-1">
                {(record.medical_prescriptions ?? []).map((item: any) => (
                  <div key={item.id} className="border border-slate-200 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-bold">{item.medication_name}</p>
                      <button
                        type="button"
                        disabled={deletingPrescriptionId === item.id}
                        onClick={() =>
                          void deletePrescription(item.id, item.medication_name)
                        }
                        className="border border-red-300 bg-white px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-50 disabled:opacity-50"
                      >
                        {deletingPrescriptionId === item.id
                          ? "삭제 중..."
                          : "처방 삭제"}
                      </button>
                    </div>
                    <p className="mt-0.5 text-xs leading-5 text-slate-600">
                      {[item.dosage, item.frequency, item.duration, item.route].filter(Boolean).join(" · ")}
                    </p>
                    {item.instructions && <p className="mt-2 text-sm">{item.instructions}</p>}
                  </div>
                ))}
              </div>

              <div className="mt-4 grid gap-2 sm:grid-cols-3">
                {[
                  ["medication_name", "약품명", "text", "예: 아목시실린"],
                  ["dosage", "1회 투여량", "text", "예: 1정"],
                  ["frequency", "복용 빈도 설명", "text", "예: 하루 2회"],
                  ["duration", "복용 기간 설명", "text", "예: 3일"],
                  ["route", "투여 경로", "text", "예: 경구"],
                  ["instructions", "복약 안내", "text", "예: 식후 투여"],
                  ["start_date", "복용 시작일", "date", ""],
                  ["end_date", "복용 종료일", "date", ""],
                  [
                    "scheduled_times_text",
                    "정확한 복용 시간",
                    "text",
                    "예: 08:00, 20:00",
                  ],
                ].map(([key, label, type, placeholder]) => (
                  <label key={key}>
                    <span className="text-sm font-bold">{label}</span>
                    <input
                      type={type}
                      value={(prescription as any)[key]}
                      placeholder={placeholder}
                      onChange={(event) =>
                        setPrescription((current) => ({
                          ...current,
                          [key]: event.target.value,
                        }))
                      }
                      className="mt-1.5 w-full border border-slate-300 px-3 py-2 text-sm"
                    />
                  </label>
                ))}
              </div>

              <button
                type="button"
                onClick={() => void addPrescription()}
                disabled={
                  !prescription.medication_name ||
                  !prescription.start_date ||
                  !prescription.end_date ||
                  !prescription.scheduled_times_text.trim()
                }
                className="mt-3 border border-slate-950 px-4 py-2.5 text-sm font-bold disabled:opacity-40"
              >
                처방 추가
              </button>
            </article>

            <div className="sticky bottom-0 z-10 grid gap-2 border border-slate-300 bg-white/95 p-2 shadow-lg backdrop-blur sm:grid-cols-2">
              <button
                type="button"
                disabled={saving}
                onClick={() => void save("draft")}
                className="border border-slate-950 bg-white px-4 py-3 text-sm font-bold"
              >
                임시 저장
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void save("completed")}
                className="bg-slate-950 px-4 py-3 text-sm font-bold text-white"
              >
                진료 완료 저장
              </button>
            </div>
          </section>
        </section>
      </div>
    </main>
  );
}
