"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { hospitalAuthFetch } from "@/lib/hospital-auth-fetch";
import InpatientCareWorkspace from "@/components/hospital/inpatients/InpatientCareWorkspace";
import InpatientVitalMonitoring from "@/components/hospital/inpatients/InpatientVitalMonitoring";
import GuardianUpdatePublisher from "@/components/hospital/inpatients/GuardianUpdatePublisher";

type HospitalizationEvent = {
  id: number;
  event_type: string;
  occurred_at: string;
  title: string;
  content: string | null;
  temperature_c: number | null;
  heart_rate_bpm: number | null;
  respiratory_rate_bpm: number | null;
  systolic_bp: number | null;
  diastolic_bp: number | null;
  oxygen_saturation_pct: number | null;
  weight_kg: number | null;
  pain_score: number | null;
  amount_value: number | null;
  amount_unit: string | null;
  status_value: string | null;
  abnormal_flag: boolean;
  requires_follow_up: boolean;
  is_guardian_visible: boolean;
  guardian_message: string | null;
};

function one(value: any) {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function localDateTimeNow() {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "-";
  return new Date(value).toLocaleString("ko-KR");
}

function statusLabel(value: string) {
  switch (value) {
    case "planned":
      return "입원 예정";
    case "admitted":
      return "입원";
    case "in_treatment":
      return "치료 중";
    case "recovering":
      return "회복 중";
    case "ready_for_discharge":
      return "퇴원 준비";
    case "discharged":
      return "퇴원";
    case "cancelled":
      return "취소";
    default:
      return value;
  }
}

function riskLabel(value: string) {
  switch (value) {
    case "standard":
      return "일반";
    case "watch":
      return "관찰";
    case "high":
      return "고위험";
    case "critical":
      return "응급";
    default:
      return value;
  }
}

function eventLabel(value: string) {
  switch (value) {
    case "vital":
      return "활력징후";
    case "meal":
      return "식사";
    case "water":
      return "음수";
    case "medication":
      return "투약";
    case "injection":
      return "주사";
    case "iv":
      return "수액";
    case "urination":
      return "배뇨";
    case "defecation":
      return "배변";
    case "vomiting":
      return "구토";
    case "pain":
      return "통증";
    case "wound":
      return "상처";
    case "mobility":
      return "보행";
    case "behavior":
      return "행동";
    case "procedure":
      return "처치";
    case "round":
      return "회진";
    case "guardian_update":
      return "보호자 안내";
    default:
      return "기타";
  }
}

function eventBadge(value: string) {
  switch (value) {
    case "vital":
      return "bg-blue-100 text-blue-800";
    case "medication":
    case "injection":
    case "iv":
      return "bg-violet-100 text-violet-800";
    case "meal":
    case "water":
      return "bg-emerald-100 text-emerald-800";
    case "urination":
    case "defecation":
      return "bg-amber-100 text-amber-800";
    case "vomiting":
    case "pain":
    case "wound":
      return "bg-red-100 text-red-800";
    default:
      return "bg-slate-200 text-slate-800";
  }
}

const emptyVitalForm = {
  occurredAt: localDateTimeNow(),
  temperatureC: "",
  heartRateBpm: "",
  respiratoryRateBpm: "",
  systolicBp: "",
  diastolicBp: "",
  oxygenSaturationPct: "",
  weightKg: "",
  painScore: "",
  content: "",
  abnormalFlag: false,
  requiresFollowUp: false,
  isGuardianVisible: false,
  guardianMessage: "",
};

export default function InpatientChartPage() {
  const params = useParams<{ hospitalizationId: string }>();
  const hospitalizationId = params.hospitalizationId;

  const [hospitalization, setHospitalization] = useState<any>(null);
  const [events, setEvents] = useState<HospitalizationEvent[]>([]);
  const [vitalEvents, setVitalEvents] = useState<HospitalizationEvent[]>([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [showVitalForm, setShowVitalForm] = useState(false);
  const [vitalForm, setVitalForm] = useState(emptyVitalForm);

  async function load() {
    setLoading(true);

    try {
      const [detailResponse, eventsResponse, vitalEventsResponse] = await Promise.all([
        hospitalAuthFetch(
          `/api/hospital/hospitalizations/${hospitalizationId}/detail`,
        ),
        hospitalAuthFetch(
          `/api/hospital/hospitalizations/${hospitalizationId}/events?type=${filter}`,
        ),
        hospitalAuthFetch(
          `/api/hospital/hospitalizations/${hospitalizationId}/events?type=vital`,
        ),
      ]);

      const detailResult = await detailResponse.json();
      const eventsResult = await eventsResponse.json();
      const vitalEventsResult = await vitalEventsResponse.json();

      if (!detailResponse.ok) {
        throw new Error(detailResult.message);
      }

      if (!eventsResponse.ok) {
        throw new Error(eventsResult.message);
      }

      if (!vitalEventsResponse.ok) {
        throw new Error(vitalEventsResult.message);
      }

      setHospitalization(detailResult.hospitalization);
      setEvents(eventsResult.events ?? []);
      setVitalEvents(vitalEventsResult.events ?? []);
      setMessage("");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "입원 차트를 불러오지 못했습니다.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hospitalizationId, filter]);

  async function submitVital(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage("");

    try {
      const response = await hospitalAuthFetch(
        `/api/hospital/hospitalizations/${hospitalizationId}/events`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            eventType: "vital",
            occurredAt: vitalForm.occurredAt
              ? new Date(vitalForm.occurredAt).toISOString()
              : null,
            title: "활력징후 측정",
            temperatureC: vitalForm.temperatureC,
            heartRateBpm: vitalForm.heartRateBpm,
            respiratoryRateBpm: vitalForm.respiratoryRateBpm,
            systolicBp: vitalForm.systolicBp,
            diastolicBp: vitalForm.diastolicBp,
            oxygenSaturationPct: vitalForm.oxygenSaturationPct,
            weightKg: vitalForm.weightKg,
            painScore: vitalForm.painScore,
            content: vitalForm.content,
            abnormalFlag: vitalForm.abnormalFlag,
            requiresFollowUp: vitalForm.requiresFollowUp,
            isGuardianVisible: vitalForm.isGuardianVisible,
            guardianMessage: vitalForm.guardianMessage,
          }),
        },
      );

      const result = await response.json();
      if (!response.ok) throw new Error(result.message);

      setVitalForm({
        ...emptyVitalForm,
        occurredAt: localDateTimeNow(),
      });
      setShowVitalForm(false);
      setMessage(result.message);
      await load();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "활력징후 저장 실패",
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteEvent(eventId: number) {
    const confirmed = window.confirm(
      "이 입원 기록을 삭제할까요? 삭제 후 복구할 수 없습니다.",
    );
    if (!confirmed) return;

    setSaving(true);
    setMessage("");

    try {
      const response = await hospitalAuthFetch(
        `/api/hospital/hospitalizations/${hospitalizationId}/events/${eventId}`,
        { method: "DELETE" },
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      setMessage(result.message);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "기록 삭제 실패");
    } finally {
      setSaving(false);
    }
  }

  const parsed = useMemo(() => {
    if (!hospitalization) return null;

    const patient = one(hospitalization.hospital_patients);
    const pet = one(patient?.pets);
    const guardian = one(patient?.reservations);

    return { patient, pet, guardian };
  }, [hospitalization]);

  const latestVital = useMemo(
    () => vitalEvents[0] ?? null,
    [vitalEvents],
  );

  if (loading && !hospitalization) {
    return (
      <main className="min-h-screen bg-slate-100 p-6">
        <div className="mx-auto max-w-5xl border border-slate-300 bg-white p-12 text-center">
          입원 차트를 불러오는 중입니다.
        </div>
      </main>
    );
  }

  if (!hospitalization || !parsed) {
    return (
      <main className="min-h-screen bg-slate-100 p-6">
        <div className="mx-auto max-w-5xl border border-slate-300 bg-white p-12 text-center">
          <p>{message || "입원 차트를 찾을 수 없습니다."}</p>
          <Link
            href="/hospital-admin/inpatients"
            className="mt-6 inline-block border border-slate-950 px-4 py-3 text-sm font-black"
          >
            입원 관리로 돌아가기
          </Link>
        </div>
      </main>
    );
  }

  const { patient, pet, guardian } = parsed;

  return (
    <main className="min-h-screen bg-slate-100 p-4 text-slate-950 lg:p-6">
      <div className="mx-auto max-w-[1500px]">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link
              href="/hospital-admin/inpatients"
              className="text-sm font-bold text-slate-500 hover:text-slate-950"
            >
              ← 입원 관리
            </Link>
            <p className="mt-4 text-xs font-black uppercase tracking-[0.18em] text-slate-500">
              Inpatient Chart #{hospitalization.id}
            </p>
            <h1 className="mt-1 text-3xl font-black">
              {pet?.name ?? "환자 정보 없음"} 입원 차트
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              {hospitalization.admission_reason}
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowVitalForm(true)}
            className="bg-slate-950 px-5 py-3 text-sm font-black text-white"
          >
            + 활력징후 기록
          </button>
        </header>

        {message && (
          <div className="mt-4 border border-slate-300 bg-white px-4 py-3 text-sm font-semibold">
            {message}
          </div>
        )}

        <section className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          {[
            ["상태", statusLabel(hospitalization.status)],
            ["위험도", riskLabel(hospitalization.risk_level)],
            ["병동", hospitalization.ward_name || "미배정"],
            ["케이지", hospitalization.cage_number || "미배정"],
            ["입원", formatDateTime(hospitalization.admitted_at)],
            [
              "퇴원 예정",
              formatDateTime(hospitalization.expected_discharge_at),
            ],
          ].map(([label, value]) => (
            <article
              key={String(label)}
              className="border border-slate-300 bg-white p-4"
            >
              <p className="text-xs font-bold text-slate-500">{label}</p>
              <p className="mt-2 text-sm font-black">{value}</p>
            </article>
          ))}
        </section>

        <InpatientCareWorkspace hospitalizationId={hospitalizationId} />

        <InpatientVitalMonitoring
          hospitalizationId={hospitalizationId}
          events={vitalEvents}
        />

        <GuardianUpdatePublisher hospitalizationId={hospitalizationId} />

        <div className="mt-5 grid gap-5 xl:grid-cols-[360px_1fr]">
          <aside className="space-y-5">
            <section className="border border-slate-300 bg-white">
              <div className="border-b border-slate-300 px-4 py-3">
                <h2 className="font-black">환자·보호자 정보</h2>
              </div>

              <dl className="grid grid-cols-[110px_1fr] text-sm">
                {[
                  ["환자명", pet?.name],
                  ["환자번호", patient?.patient_number],
                  ["종류", pet?.species],
                  ["품종", pet?.breed],
                  ["성별", pet?.gender],
                  ["기준 체중", pet?.weight_kg ? `${pet.weight_kg} kg` : "-"],
                  ["보호자", guardian?.guardian_name],
                  ["연락처", guardian?.phone],
                ].map(([label, value]) => (
                  <div key={String(label)} className="contents">
                    <dt className="border-b border-r border-slate-200 bg-slate-50 px-3 py-2 font-bold">
                      {label}
                    </dt>
                    <dd className="border-b border-slate-200 px-3 py-2">
                      {value || "-"}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>

            <section className="border border-slate-300 bg-white">
              <div className="border-b border-slate-300 px-4 py-3">
                <h2 className="font-black">최근 활력징후</h2>
              </div>

              {latestVital ? (
                <div className="grid grid-cols-2 gap-px bg-slate-200">
                  {[
                    [
                      "체온",
                      latestVital.temperature_c !== null
                        ? `${latestVital.temperature_c} ℃`
                        : "-",
                    ],
                    [
                      "심박",
                      latestVital.heart_rate_bpm !== null
                        ? `${latestVital.heart_rate_bpm} bpm`
                        : "-",
                    ],
                    [
                      "호흡",
                      latestVital.respiratory_rate_bpm !== null
                        ? `${latestVital.respiratory_rate_bpm} /min`
                        : "-",
                    ],
                    [
                      "혈압",
                      latestVital.systolic_bp !== null ||
                      latestVital.diastolic_bp !== null
                        ? `${latestVital.systolic_bp ?? "-"} / ${
                            latestVital.diastolic_bp ?? "-"
                          }`
                        : "-",
                    ],
                    [
                      "SpO₂",
                      latestVital.oxygen_saturation_pct !== null
                        ? `${latestVital.oxygen_saturation_pct} %`
                        : "-",
                    ],
                    [
                      "체중",
                      latestVital.weight_kg !== null
                        ? `${latestVital.weight_kg} kg`
                        : "-",
                    ],
                    [
                      "통증",
                      latestVital.pain_score !== null
                        ? `${latestVital.pain_score} / 10`
                        : "-",
                    ],
                  ].map(([label, value]) => (
                    <div key={String(label)} className="bg-white p-3">
                      <p className="text-xs font-bold text-slate-500">
                        {label}
                      </p>
                      <p className="mt-1 font-black">{value}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="p-6 text-center text-sm text-slate-500">
                  등록된 활력징후가 없습니다.
                </p>
              )}
            </section>

            <section className="border border-slate-300 bg-white p-4 text-sm">
              <h2 className="font-black">입원 주의사항</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {hospitalization.isolation_required && (
                  <span className="bg-violet-100 px-3 py-2 font-bold text-violet-800">
                    격리 필요
                  </span>
                )}
                {hospitalization.fasting_required && (
                  <span className="bg-slate-200 px-3 py-2 font-bold">
                    금식 필요
                  </span>
                )}
                {!hospitalization.isolation_required &&
                  !hospitalization.fasting_required && (
                    <span className="text-slate-500">
                      별도 주의사항이 설정되지 않았습니다.
                    </span>
                  )}
              </div>

              {hospitalization.internal_note && (
                <div className="mt-4 border-t border-slate-200 pt-4">
                  <p className="text-xs font-bold text-slate-500">
                    병원 내부 메모
                  </p>
                  <p className="mt-2 whitespace-pre-wrap leading-6">
                    {hospitalization.internal_note}
                  </p>
                </div>
              )}
            </section>
          </aside>

          <section className="border border-slate-300 bg-white">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-300 px-4 py-3">
              <div>
                <h2 className="font-black">입원 타임라인</h2>
                <p className="mt-1 text-xs text-slate-500">
                  최신 기록부터 표시됩니다.
                </p>
              </div>

              <select
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
                className="border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="all">전체 기록</option>
                <option value="vital">활력징후</option>
                <option value="meal">식사</option>
                <option value="water">음수</option>
                <option value="medication">투약</option>
                <option value="injection">주사</option>
                <option value="iv">수액</option>
                <option value="urination">배뇨</option>
                <option value="defecation">배변</option>
                <option value="vomiting">구토</option>
                <option value="pain">통증</option>
                <option value="wound">상처</option>
                <option value="round">회진</option>
                <option value="other">기타</option>
              </select>
            </div>

            <div className="p-4">
              {events.length === 0 ? (
                <div className="py-20 text-center text-slate-500">
                  등록된 입원 기록이 없습니다.
                </div>
              ) : (
                <div className="relative space-y-4 before:absolute before:bottom-0 before:left-[15px] before:top-0 before:w-px before:bg-slate-300">
                  {events.map((item) => (
                    <article
                      key={item.id}
                      className={`relative ml-8 border bg-white p-4 ${
                        item.abnormal_flag
                          ? "border-red-400"
                          : "border-slate-300"
                      }`}
                    >
                      <span
                        className={`absolute -left-[26px] top-5 h-3 w-3 rounded-full border-2 border-white ${
                          item.abnormal_flag
                            ? "bg-red-600"
                            : "bg-slate-950"
                        }`}
                      />

                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`px-2 py-1 text-[11px] font-black ${eventBadge(
                                item.event_type,
                              )}`}
                            >
                              {eventLabel(item.event_type)}
                            </span>
                            {item.abnormal_flag && (
                              <span className="bg-red-100 px-2 py-1 text-[11px] font-black text-red-800">
                                이상
                              </span>
                            )}
                            {item.requires_follow_up && (
                              <span className="bg-orange-100 px-2 py-1 text-[11px] font-black text-orange-800">
                                재확인 필요
                              </span>
                            )}
                            {item.is_guardian_visible && (
                              <span className="bg-cyan-100 px-2 py-1 text-[11px] font-black text-cyan-800">
                                보호자 공개
                              </span>
                            )}
                          </div>

                          <h3 className="mt-2 font-black">{item.title}</h3>
                          <p className="mt-1 text-xs text-slate-500">
                            {formatDateTime(item.occurred_at)}
                          </p>
                        </div>

                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => void deleteEvent(item.id)}
                          className="text-xs font-bold text-red-700 disabled:opacity-50"
                        >
                          삭제
                        </button>
                      </div>

                      {item.event_type === "vital" && (
                        <div className="mt-4 grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
                          {[
                            [
                              "체온",
                              item.temperature_c !== null
                                ? `${item.temperature_c} ℃`
                                : "-",
                            ],
                            [
                              "심박",
                              item.heart_rate_bpm !== null
                                ? `${item.heart_rate_bpm} bpm`
                                : "-",
                            ],
                            [
                              "호흡",
                              item.respiratory_rate_bpm !== null
                                ? `${item.respiratory_rate_bpm} /min`
                                : "-",
                            ],
                            [
                              "혈압",
                              item.systolic_bp !== null ||
                              item.diastolic_bp !== null
                                ? `${item.systolic_bp ?? "-"} / ${
                                    item.diastolic_bp ?? "-"
                                  }`
                                : "-",
                            ],
                            [
                              "SpO₂",
                              item.oxygen_saturation_pct !== null
                                ? `${item.oxygen_saturation_pct} %`
                                : "-",
                            ],
                            [
                              "체중",
                              item.weight_kg !== null
                                ? `${item.weight_kg} kg`
                                : "-",
                            ],
                            [
                              "통증",
                              item.pain_score !== null
                                ? `${item.pain_score} / 10`
                                : "-",
                            ],
                          ].map(([label, value]) => (
                            <div
                              key={String(label)}
                              className="border border-slate-200 bg-slate-50 p-2"
                            >
                              <p className="text-[11px] font-bold text-slate-500">
                                {label}
                              </p>
                              <p className="mt-1 text-sm font-black">
                                {value}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}

                      {item.content && (
                        <p className="mt-4 whitespace-pre-wrap text-sm leading-6">
                          {item.content}
                        </p>
                      )}

                      {item.guardian_message && (
                        <div className="mt-4 border-l-4 border-cyan-400 bg-cyan-50 px-3 py-2 text-sm">
                          <p className="text-xs font-black text-cyan-800">
                            보호자 공개 문구
                          </p>
                          <p className="mt-1 whitespace-pre-wrap">
                            {item.guardian_message}
                          </p>
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>
      </div>

      {showVitalForm && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 p-4">
          <div className="mx-auto my-6 max-w-4xl border border-slate-400 bg-white">
            <div className="flex items-center justify-between border-b border-slate-300 px-5 py-4">
              <div>
                <p className="text-xs font-bold text-slate-500">
                  Vital Signs
                </p>
                <h2 className="text-xl font-black">활력징후 기록</h2>
              </div>
              <button
                type="button"
                onClick={() => setShowVitalForm(false)}
                className="border border-slate-300 px-3 py-2 text-sm font-bold"
              >
                닫기
              </button>
            </div>

            <form
              onSubmit={submitVital}
              className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3"
            >
              <label className="lg:col-span-3">
                <span className="mb-1 block text-sm font-bold">
                  측정 시각
                </span>
                <input
                  type="datetime-local"
                  value={vitalForm.occurredAt}
                  onChange={(event) =>
                    setVitalForm((current) => ({
                      ...current,
                      occurredAt: event.target.value,
                    }))
                  }
                  className="w-full border border-slate-300 px-3 py-3"
                />
              </label>

              {[
                ["temperatureC", "체온 (℃)", "number", "0.1"],
                ["heartRateBpm", "심박수 (bpm)", "number", "1"],
                [
                  "respiratoryRateBpm",
                  "호흡수 (/min)",
                  "number",
                  "1",
                ],
                ["systolicBp", "수축기 혈압", "number", "1"],
                ["diastolicBp", "이완기 혈압", "number", "1"],
                ["oxygenSaturationPct", "SpO₂ (%)", "number", "0.1"],
                ["weightKg", "체중 (kg)", "number", "0.01"],
                ["painScore", "통증 점수 (0~10)", "number", "1"],
              ].map(([key, label, type, step]) => (
                <label key={key}>
                  <span className="mb-1 block text-sm font-bold">
                    {label}
                  </span>
                  <input
                    type={type}
                    step={step}
                    min={key === "painScore" ? "0" : undefined}
                    max={key === "painScore" ? "10" : undefined}
                    value={(vitalForm as any)[key]}
                    onChange={(event) =>
                      setVitalForm((current) => ({
                        ...current,
                        [key]: event.target.value,
                      }))
                    }
                    className="w-full border border-slate-300 px-3 py-3"
                  />
                </label>
              ))}

              <label className="sm:col-span-2 lg:col-span-3">
                <span className="mb-1 block text-sm font-bold">
                  관찰 내용
                </span>
                <textarea
                  rows={3}
                  value={vitalForm.content}
                  onChange={(event) =>
                    setVitalForm((current) => ({
                      ...current,
                      content: event.target.value,
                    }))
                  }
                  className="w-full border border-slate-300 px-3 py-3"
                  placeholder="점막색, 의식상태, 호흡 양상 등 추가 관찰 내용을 입력하세요."
                />
              </label>

              <div className="flex flex-wrap gap-5 border border-slate-300 p-4 sm:col-span-2 lg:col-span-3">
                <label className="flex items-center gap-2 text-sm font-bold">
                  <input
                    type="checkbox"
                    checked={vitalForm.abnormalFlag}
                    onChange={(event) =>
                      setVitalForm((current) => ({
                        ...current,
                        abnormalFlag: event.target.checked,
                      }))
                    }
                  />
                  이상 소견
                </label>

                <label className="flex items-center gap-2 text-sm font-bold">
                  <input
                    type="checkbox"
                    checked={vitalForm.requiresFollowUp}
                    onChange={(event) =>
                      setVitalForm((current) => ({
                        ...current,
                        requiresFollowUp: event.target.checked,
                      }))
                    }
                  />
                  재확인 필요
                </label>

                <label className="flex items-center gap-2 text-sm font-bold">
                  <input
                    type="checkbox"
                    checked={vitalForm.isGuardianVisible}
                    onChange={(event) =>
                      setVitalForm((current) => ({
                        ...current,
                        isGuardianVisible: event.target.checked,
                      }))
                    }
                  />
                  보호자 공개
                </label>
              </div>

              {vitalForm.isGuardianVisible && (
                <label className="sm:col-span-2 lg:col-span-3">
                  <span className="mb-1 block text-sm font-bold">
                    보호자 공개 문구
                  </span>
                  <textarea
                    rows={2}
                    value={vitalForm.guardianMessage}
                    onChange={(event) =>
                      setVitalForm((current) => ({
                        ...current,
                        guardianMessage: event.target.value,
                      }))
                    }
                    className="w-full border border-slate-300 px-3 py-3"
                    placeholder="예: 체온과 호흡 상태가 안정적으로 유지되고 있습니다."
                  />
                </label>
              )}

              <div className="flex justify-end gap-2 border-t border-slate-300 pt-4 sm:col-span-2 lg:col-span-3">
                <button
                  type="button"
                  onClick={() => setShowVitalForm(false)}
                  className="border border-slate-300 px-5 py-3 text-sm font-bold"
                >
                  취소
                </button>
                <button
                  disabled={saving}
                  className="bg-slate-950 px-6 py-3 text-sm font-black text-white disabled:opacity-50"
                >
                  {saving ? "저장 중..." : "활력징후 저장"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
