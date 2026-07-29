"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { hospitalAuthFetch } from "@/lib/hospital-auth-fetch";

type Patient = {
  id: number;
  patient_number: string | null;
  pets: any;
  reservations: any;
};

type Hospitalization = {
  id: number;
  status: string;
  admission_reason: string;
  ward_name: string | null;
  cage_number: string | null;
  admitted_at: string;
  expected_discharge_at: string | null;
  risk_level: string;
  isolation_required: boolean;
  fasting_required: boolean;
  internal_note: string | null;
  hospital_patients: any;
};

type Stats = {
  active: number;
  critical: number;
  highRisk: number;
  isolation: number;
  expectedDischargeToday: number;
};

const emptyStats: Stats = {
  active: 0,
  critical: 0,
  highRisk: 0,
  isolation: 0,
  expectedDischargeToday: 0,
};

function one(value: any) {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function dateTimeLocalNow() {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 16);
}

function formatDateTime(value: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString("ko-KR", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
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

function riskClass(value: string) {
  switch (value) {
    case "standard":
      return "border-emerald-300 bg-emerald-50 text-emerald-800";
    case "watch":
      return "border-amber-300 bg-amber-50 text-amber-800";
    case "high":
      return "border-orange-300 bg-orange-50 text-orange-800";
    case "critical":
      return "border-red-400 bg-red-50 text-red-800";
    default:
      return "border-slate-300 bg-slate-50 text-slate-700";
  }
}

export default function InpatientsPage() {
  const [rows, setRows] = useState<Hospitalization[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [stats, setStats] = useState<Stats>(emptyStats);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("active");
  const [risk, setRisk] = useState("all");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  const [form, setForm] = useState({
    hospitalPatientId: "",
    admissionReason: "",
    wardName: "",
    cageNumber: "",
    admittedAt: dateTimeLocalNow(),
    expectedDischargeAt: "",
    riskLevel: "standard",
    isolationRequired: false,
    fastingRequired: false,
    internalNote: "",
  });

  async function loadRows() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ q, status, risk });
      const response = await hospitalAuthFetch(
        `/api/hospital/hospitalizations?${params.toString()}`,
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      setRows(result.hospitalizations ?? []);
      setStats(result.stats ?? emptyStats);
      setMessage("");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "입원 환자 조회 실패",
      );
    } finally {
      setLoading(false);
    }
  }

  async function loadPatients() {
    try {
      const response = await hospitalAuthFetch("/api/hospital/patients");
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      setPatients(result.patients ?? []);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "환자 목록 조회 실패",
      );
    }
  }

  useEffect(() => {
    void Promise.all([loadRows(), loadPatients()]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createHospitalization(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage("");

    try {
      const response = await hospitalAuthFetch(
        "/api/hospital/hospitalizations",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...form,
            hospitalPatientId: Number(form.hospitalPatientId),
            admittedAt: form.admittedAt
              ? new Date(form.admittedAt).toISOString()
              : null,
            expectedDischargeAt: form.expectedDischargeAt
              ? new Date(form.expectedDischargeAt).toISOString()
              : null,
          }),
        },
      );

      const result = await response.json();
      if (!response.ok) throw new Error(result.message);

      setShowCreate(false);
      setForm({
        hospitalPatientId: "",
        admissionReason: "",
        wardName: "",
        cageNumber: "",
        admittedAt: dateTimeLocalNow(),
        expectedDischargeAt: "",
        riskLevel: "standard",
        isolationRequired: false,
        fastingRequired: false,
        internalNote: "",
      });
      setMessage(result.message);
      await loadRows();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "입원 등록 실패");
    } finally {
      setSaving(false);
    }
  }

  async function quickUpdate(
    id: number,
    updates: Record<string, unknown>,
  ) {
    setSaving(true);
    setMessage("");

    try {
      const response = await hospitalAuthFetch(
        `/api/hospital/hospitalizations/${id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updates),
        },
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      setMessage(result.message);
      await loadRows();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "변경 실패");
    } finally {
      setSaving(false);
    }
  }

  const occupiedCages = useMemo(
    () =>
      rows.filter(
        (row) =>
          row.ward_name &&
          row.cage_number &&
          !["discharged", "cancelled"].includes(row.status),
      ),
    [rows],
  );

  return (
    <main className="min-h-screen bg-slate-100 p-4 text-slate-950 lg:p-6">
      <div className="mx-auto max-w-[1600px]">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
              Inpatient Management
            </p>
            <h1 className="mt-1 text-3xl font-black">입원 관리</h1>
            <p className="mt-2 text-sm text-slate-600">
              현재 입원 환자, 위험도, 병동과 케이지 상태를 관리합니다.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/hospital-admin/inpatient-surgery"
              className="border border-slate-950 bg-white px-5 py-3 text-sm font-black text-slate-950"
            >
              병상·수술 운영
            </Link>
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="bg-slate-950 px-5 py-3 text-sm font-black text-white"
            >
              + 입원 등록
            </button>
          </div>
        </header>

        <section className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {[
            ["현재 입원", stats.active, "명"],
            ["고위험 이상", stats.highRisk, "명"],
            ["응급", stats.critical, "명"],
            ["격리", stats.isolation, "명"],
            ["오늘 퇴원 예정", stats.expectedDischargeToday, "명"],
          ].map(([label, value, unit]) => (
            <article
              key={String(label)}
              className="border border-slate-300 bg-white p-4"
            >
              <p className="text-xs font-bold text-slate-500">{label}</p>
              <p className="mt-2 text-2xl font-black">
                {value}
                <span className="ml-1 text-sm font-bold text-slate-500">
                  {unit}
                </span>
              </p>
            </article>
          ))}
        </section>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            void loadRows();
          }}
          className="mt-5 grid gap-2 border border-slate-300 bg-white p-3 lg:grid-cols-[1fr_180px_160px_auto]"
        >
          <input
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder="환자명, 보호자, 환자번호, 병동, 케이지 검색"
            className="border border-slate-300 px-4 py-3 text-sm"
          />

          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="border border-slate-300 px-3 py-3 text-sm"
          >
            <option value="active">현재 입원</option>
            <option value="all">전체 상태</option>
            <option value="planned">입원 예정</option>
            <option value="admitted">입원</option>
            <option value="in_treatment">치료 중</option>
            <option value="recovering">회복 중</option>
            <option value="ready_for_discharge">퇴원 준비</option>
            <option value="discharged">퇴원</option>
            <option value="cancelled">취소</option>
          </select>

          <select
            value={risk}
            onChange={(event) => setRisk(event.target.value)}
            className="border border-slate-300 px-3 py-3 text-sm"
          >
            <option value="all">전체 위험도</option>
            <option value="standard">일반</option>
            <option value="watch">관찰</option>
            <option value="high">고위험</option>
            <option value="critical">응급</option>
          </select>

          <button className="bg-slate-950 px-5 py-3 text-sm font-black text-white">
            조회
          </button>
        </form>

        {message && (
          <div className="mt-4 border border-slate-300 bg-white px-4 py-3 text-sm font-semibold">
            {message}
          </div>
        )}

        <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_340px]">
          <section className="overflow-hidden border border-slate-300 bg-white">
            <div className="border-b border-slate-300 px-4 py-3">
              <h2 className="font-black">입원 환자 목록</h2>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[1050px] text-left text-sm">
                <thead className="bg-slate-100 text-xs text-slate-600">
                  <tr>
                    <th className="px-4 py-3">위험도</th>
                    <th className="px-4 py-3">환자</th>
                    <th className="px-4 py-3">입원 사유</th>
                    <th className="px-4 py-3">병동·케이지</th>
                    <th className="px-4 py-3">입원 / 퇴원 예정</th>
                    <th className="px-4 py-3">상태</th>
                    <th className="px-4 py-3">빠른 변경</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const patient = one(row.hospital_patients);
                    const pet = one(patient?.pets);
                    const guardian = one(patient?.reservations);

                    return (
                      <tr
                        key={row.id}
                        className="border-t border-slate-200 align-top"
                      >
                        <td className="px-4 py-4">
                          <span
                            className={`inline-flex border px-2 py-1 text-xs font-black ${riskClass(
                              row.risk_level,
                            )}`}
                          >
                            {riskLabel(row.risk_level)}
                          </span>
                          <div className="mt-2 flex flex-wrap gap-1">
                            {row.isolation_required && (
                              <span className="bg-violet-100 px-2 py-1 text-[11px] font-bold text-violet-800">
                                격리
                              </span>
                            )}
                            {row.fasting_required && (
                              <span className="bg-slate-200 px-2 py-1 text-[11px] font-bold">
                                금식
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="px-4 py-4">
                          <p className="font-black">{pet?.name ?? "-"}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            {pet?.breed || pet?.species || "정보 없음"}
                          </p>
                          <p className="mt-1 font-mono text-[11px] text-slate-500">
                            {patient?.patient_number || `P-${patient?.id}`}
                          </p>
                          <p className="mt-2 text-xs">
                            {guardian?.guardian_name || "-"} ·{" "}
                            {guardian?.phone || "-"}
                          </p>
                        </td>

                        <td className="max-w-[250px] px-4 py-4">
                          <p className="line-clamp-3 font-semibold">
                            {row.admission_reason}
                          </p>
                        </td>

                        <td className="px-4 py-4">
                          <p className="font-black">
                            {row.ward_name || "미배정"}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            케이지 {row.cage_number || "-"}
                          </p>
                        </td>

                        <td className="px-4 py-4 text-xs leading-6">
                          <p>입원 {formatDateTime(row.admitted_at)}</p>
                          <p>
                            퇴원 예정{" "}
                            {formatDateTime(row.expected_discharge_at)}
                          </p>
                        </td>

                        <td className="px-4 py-4">
                          <select
                            value={row.status}
                            disabled={saving}
                            onChange={(event) =>
                              void quickUpdate(row.id, {
                                status: event.target.value,
                              })
                            }
                            className="border border-slate-300 px-2 py-2 text-xs font-bold"
                          >
                            <option value="planned">입원 예정</option>
                            <option value="admitted">입원</option>
                            <option value="in_treatment">치료 중</option>
                            <option value="recovering">회복 중</option>
                            <option value="ready_for_discharge">
                              퇴원 준비
                            </option>
                            <option value="discharged">퇴원</option>
                            <option value="cancelled">취소</option>
                          </select>
                          <p className="mt-2 text-xs font-bold text-slate-500">
                            {statusLabel(row.status)}
                          </p>
                        </td>

                        <td className="px-4 py-4">
                          <div className="flex flex-col gap-2">
                            <select
                              value={row.risk_level}
                              disabled={saving}
                              onChange={(event) =>
                                void quickUpdate(row.id, {
                                  riskLevel: event.target.value,
                                })
                              }
                              className="border border-slate-300 px-2 py-2 text-xs"
                            >
                              <option value="standard">일반</option>
                              <option value="watch">관찰</option>
                              <option value="high">고위험</option>
                              <option value="critical">응급</option>
                            </select>

                            <Link
                              href={`/hospital-admin/inpatients/${row.id}`}
                              className="border border-slate-950 px-3 py-2 text-center text-xs font-black hover:bg-slate-950 hover:text-white"
                            >
                              입원 차트
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                  {!loading && rows.length === 0 && (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-4 py-20 text-center text-slate-500"
                      >
                        조건에 맞는 입원 환자가 없습니다.
                      </td>
                    </tr>
                  )}

                  {loading && (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-4 py-20 text-center text-slate-500"
                      >
                        입원 현황을 불러오는 중입니다.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <aside className="border border-slate-300 bg-white">
            <div className="border-b border-slate-300 px-4 py-3">
              <h2 className="font-black">병동·케이지 현황</h2>
            </div>

            <div className="space-y-3 p-4">
              {occupiedCages.map((row) => {
                const patient = one(row.hospital_patients);
                const pet = one(patient?.pets);

                return (
                  <article
                    key={row.id}
                    className={`border p-3 ${riskClass(row.risk_level)}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-bold">
                          {row.ward_name} · {row.cage_number}
                        </p>
                        <p className="mt-1 text-lg font-black">
                          {pet?.name ?? "-"}
                        </p>
                      </div>
                      <span className="text-xs font-black">
                        {riskLabel(row.risk_level)}
                      </span>
                    </div>
                    <p className="mt-2 text-xs">
                      {statusLabel(row.status)}
                    </p>
                  </article>
                );
              })}

              {occupiedCages.length === 0 && (
                <p className="py-12 text-center text-sm text-slate-500">
                  배정된 케이지가 없습니다.
                </p>
              )}
            </div>
          </aside>
        </div>
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 p-4">
          <div className="mx-auto my-6 max-w-3xl border border-slate-400 bg-white">
            <div className="flex items-center justify-between border-b border-slate-300 px-5 py-4">
              <div>
                <p className="text-xs font-bold text-slate-500">
                  New Admission
                </p>
                <h2 className="text-xl font-black">입원 등록</h2>
              </div>
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="border border-slate-300 px-3 py-2 text-sm font-bold"
              >
                닫기
              </button>
            </div>

            <form
              onSubmit={createHospitalization}
              className="grid gap-4 p-5 md:grid-cols-2"
            >
              <label className="md:col-span-2">
                <span className="mb-1 block text-sm font-bold">환자</span>
                <select
                  required
                  value={form.hospitalPatientId}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      hospitalPatientId: event.target.value,
                    }))
                  }
                  className="w-full border border-slate-300 px-3 py-3"
                >
                  <option value="">환자를 선택하세요</option>
                  {patients.map((patient) => {
                    const pet = one(patient.pets);
                    const guardian = one(patient.reservations);
                    return (
                      <option key={patient.id} value={patient.id}>
                        {pet?.name ?? "이름 없음"} ·{" "}
                        {patient.patient_number || `P-${patient.id}`} ·{" "}
                        {guardian?.guardian_name || "보호자 정보 없음"}
                      </option>
                    );
                  })}
                </select>
              </label>

              <label className="md:col-span-2">
                <span className="mb-1 block text-sm font-bold">
                  입원 사유
                </span>
                <textarea
                  required
                  value={form.admissionReason}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      admissionReason: event.target.value,
                    }))
                  }
                  rows={3}
                  className="w-full border border-slate-300 px-3 py-3"
                  placeholder="입원 목적과 현재 상태를 입력하세요."
                />
              </label>

              <label>
                <span className="mb-1 block text-sm font-bold">병동</span>
                <input
                  value={form.wardName}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      wardName: event.target.value,
                    }))
                  }
                  className="w-full border border-slate-300 px-3 py-3"
                  placeholder="예: 일반병동 A"
                />
              </label>

              <label>
                <span className="mb-1 block text-sm font-bold">
                  케이지 번호
                </span>
                <input
                  value={form.cageNumber}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      cageNumber: event.target.value,
                    }))
                  }
                  className="w-full border border-slate-300 px-3 py-3"
                  placeholder="예: A-03"
                />
              </label>

              <label>
                <span className="mb-1 block text-sm font-bold">
                  입원 시각
                </span>
                <input
                  type="datetime-local"
                  value={form.admittedAt}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      admittedAt: event.target.value,
                    }))
                  }
                  className="w-full border border-slate-300 px-3 py-3"
                />
              </label>

              <label>
                <span className="mb-1 block text-sm font-bold">
                  퇴원 예정
                </span>
                <input
                  type="datetime-local"
                  value={form.expectedDischargeAt}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      expectedDischargeAt: event.target.value,
                    }))
                  }
                  className="w-full border border-slate-300 px-3 py-3"
                />
              </label>

              <label>
                <span className="mb-1 block text-sm font-bold">위험도</span>
                <select
                  value={form.riskLevel}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      riskLevel: event.target.value,
                    }))
                  }
                  className="w-full border border-slate-300 px-3 py-3"
                >
                  <option value="standard">일반</option>
                  <option value="watch">관찰</option>
                  <option value="high">고위험</option>
                  <option value="critical">응급</option>
                </select>
              </label>

              <div className="flex flex-wrap items-center gap-5 border border-slate-300 px-4 py-3">
                <label className="flex items-center gap-2 text-sm font-bold">
                  <input
                    type="checkbox"
                    checked={form.isolationRequired}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        isolationRequired: event.target.checked,
                      }))
                    }
                  />
                  격리 필요
                </label>

                <label className="flex items-center gap-2 text-sm font-bold">
                  <input
                    type="checkbox"
                    checked={form.fastingRequired}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        fastingRequired: event.target.checked,
                      }))
                    }
                  />
                  금식 필요
                </label>
              </div>

              <label className="md:col-span-2">
                <span className="mb-1 block text-sm font-bold">
                  병원 내부 메모
                </span>
                <textarea
                  value={form.internalNote}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      internalNote: event.target.value,
                    }))
                  }
                  rows={3}
                  className="w-full border border-slate-300 px-3 py-3"
                />
              </label>

              <div className="flex justify-end gap-2 border-t border-slate-300 pt-4 md:col-span-2">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="border border-slate-300 px-5 py-3 text-sm font-bold"
                >
                  취소
                </button>
                <button
                  disabled={saving}
                  className="bg-slate-950 px-6 py-3 text-sm font-black text-white disabled:opacity-50"
                >
                  {saving ? "등록 중..." : "입원 등록"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
