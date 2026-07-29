"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../../../../lib/supabase";

function NewEmrContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialPetId = searchParams.get("petId") ?? "";
  const initialReservationId = searchParams.get("reservationId") ?? "";

  const [patients, setPatients] = useState<any[]>([]);
  const [reservations, setReservations] = useState<any[]>([]);
  const [petId, setPetId] = useState(initialPetId);
  const [reservationId, setReservationId] = useState(initialReservationId);
  const [form, setForm] = useState({
    chiefComplaint: "",
    subjective: "",
    objective: "",
    assessment: "",
    plan: "",
    diagnosisSummary: "",
    weightKg: "",
    temperatureC: "",
    heartRate: "",
    respiratoryRate: "",
    bcs: "",
    crtSeconds: "",
    nextVisitDate: "",
  });
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  async function token() {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? "";
  }

  useEffect(() => {
    async function load() {
      const accessToken = await token();
      if (!accessToken) return;

      const response = await fetch("/api/hospital/patients", {
        headers: { authorization: `Bearer ${accessToken}` },
      });

      if (response.ok) {
        const result = await response.json();
        setPatients(result.patients ?? result.rows ?? []);
      }

      const reservationResponse = await fetch(
        "/api/hospital/reservations?limit=300",
        { headers: { authorization: `Bearer ${accessToken}` } },
      );

      if (reservationResponse.ok) {
        const result = await reservationResponse.json();
        setReservations(result.reservations ?? []);
      }
    }

    void load();
  }, []);

  const selectedPet = useMemo(
    () =>
      patients.find(
        (row) => String(row.id ?? row.pet_id ?? row.pets?.id) === petId,
      ),
    [patients, petId],
  );

  const petReservations = useMemo(
    () =>
      reservations.filter(
        (row) => String(row.pet_id ?? row.pets?.id) === petId,
      ),
    [reservations, petId],
  );

  useEffect(() => {
    const weight =
      selectedPet?.weight_kg ??
      selectedPet?.pets?.weight_kg ??
      selectedPet?.pet?.weight_kg;

    if (weight != null && form.weightKg === "") {
      setForm((current) => ({ ...current, weightKg: String(weight) }));
    }
  }, [selectedPet]);

  async function create() {
    if (saving) return;
    setSaving(true);
    const accessToken = await token();

    const response = await fetch("/api/hospital/emr/records", {
      method: "POST",
      headers: {
        authorization: `Bearer ${accessToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ ...form, petId, reservationId }),
    });

    const result = await response.json();
    setSaving(false);

    if (!response.ok) {
      setMessage(result.message ?? "차트를 생성하지 못했습니다.");
      return;
    }

    router.replace(`/hospital-admin/emr/${result.id}`);
  }

  return (
    <main className="px-4 py-5 text-slate-950 sm:px-6">
      <div className="mx-auto max-w-[1500px]">
        <header className="border-b border-slate-300 pb-4">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">
            New Electronic Medical Record
          </p>
          <h1 className="mt-1 text-2xl font-black">새 전자차트</h1>
          <p className="mt-2 text-sm text-slate-500">
            환자와 예약을 선택한 뒤 SOAP 형식으로 진료 내용을 기록합니다.
          </p>
        </header>

        {message && (
          <div className="mt-3 border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
            {message}
          </div>
        )}

        <section className="mt-4 grid gap-3 border border-slate-300 bg-white p-4 md:grid-cols-2">
          <label className="text-xs font-bold text-slate-600">
            환자
            <select
              value={petId}
              onChange={(event) => {
                setPetId(event.target.value);
                setReservationId("");
              }}
              className="mt-1 w-full border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              <option value="">환자 선택</option>
              {patients.map((row) => {
                const pet = row.pet ?? row.pets ?? row;
                return (
                  <option key={pet.id} value={pet.id}>
                    {pet.name} · {pet.species ?? "-"} · {pet.breed ?? "-"}
                  </option>
                );
              })}
            </select>
          </label>

          <label className="text-xs font-bold text-slate-600">
            예약 연결
            <select
              value={reservationId}
              onChange={(event) => setReservationId(event.target.value)}
              className="mt-1 w-full border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              <option value="">예약 없이 작성</option>
              {petReservations.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.reservation_date} {row.reservation_time?.slice(0, 5)} ·{" "}
                  {row.visit_reason ?? "-"}
                </option>
              ))}
            </select>
          </label>
        </section>

        <Editor
          form={form}
          setForm={setForm}
          readonly={false}
        />

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            disabled={saving}
            onClick={() => void create()}
            className="border border-slate-900 bg-slate-900 px-6 py-3 text-sm font-bold text-white disabled:opacity-50"
          >
            {saving ? "생성 중" : "차트 생성"}
          </button>
        </div>
      </div>
    </main>
  );
}

function Editor({
  form,
  setForm,
  readonly,
}: {
  form: any;
  setForm: (value: any) => void;
  readonly: boolean;
}) {
  return (
    <>
      <section className="mt-4 grid gap-px bg-slate-300 md:grid-cols-3 xl:grid-cols-6">
        {[
          ["weightKg", "체중", "kg"],
          ["temperatureC", "체온", "℃"],
          ["heartRate", "심박수", "bpm"],
          ["respiratoryRate", "호흡수", "/min"],
          ["bcs", "BCS", "/9"],
          ["crtSeconds", "CRT", "초"],
        ].map(([key, label, unit]) => (
          <label key={key} className="bg-white p-3 text-xs font-bold text-slate-600">
            {label}
            <div className="mt-1 flex items-center gap-2">
              <input
                disabled={readonly}
                value={form[key]}
                onChange={(event) =>
                  setForm({ ...form, [key]: event.target.value })
                }
                inputMode="decimal"
                className="min-w-0 flex-1 border border-slate-300 px-3 py-2 text-sm"
              />
              <span className="text-[11px]">{unit}</span>
            </div>
          </label>
        ))}
      </section>

      <section className="mt-4 border border-slate-300 bg-white">
        <Field
          code="CC"
          label="주호소"
          value={form.chiefComplaint}
          onChange={(value) => setForm({ ...form, chiefComplaint: value })}
          readonly={readonly}
          rows={2}
        />
        <Field
          code="S"
          label="Subjective · 보호자 진술과 증상"
          value={form.subjective}
          onChange={(value) => setForm({ ...form, subjective: value })}
          readonly={readonly}
        />
        <Field
          code="O"
          label="Objective · 신체검사와 객관적 소견"
          value={form.objective}
          onChange={(value) => setForm({ ...form, objective: value })}
          readonly={readonly}
        />
        <Field
          code="A"
          label="Assessment · 평가와 감별진단"
          value={form.assessment}
          onChange={(value) => setForm({ ...form, assessment: value })}
          readonly={readonly}
        />
        <Field
          code="P"
          label="Plan · 치료·검사·처방·추적 계획"
          value={form.plan}
          onChange={(value) => setForm({ ...form, plan: value })}
          readonly={readonly}
        />
      </section>

      <section className="mt-4 grid gap-3 border border-slate-300 bg-white p-4 md:grid-cols-[1fr_220px]">
        <label className="text-xs font-bold text-slate-600">
          진단 요약
          <input
            disabled={readonly}
            value={form.diagnosisSummary}
            onChange={(event) =>
              setForm({ ...form, diagnosisSummary: event.target.value })
            }
            className="mt-1 w-full border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="text-xs font-bold text-slate-600">
          재진 권장일
          <input
            type="date"
            disabled={readonly}
            value={form.nextVisitDate}
            onChange={(event) =>
              setForm({ ...form, nextVisitDate: event.target.value })
            }
            className="mt-1 w-full border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
      </section>
    </>
  );
}

function Field({
  code,
  label,
  value,
  onChange,
  readonly,
  rows = 5,
}: {
  code: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  readonly: boolean;
  rows?: number;
}) {
  return (
    <div className="grid border-b border-slate-300 last:border-b-0 md:grid-cols-[70px_1fr]">
      <div className="flex items-center justify-center bg-slate-100 p-3 text-xl font-black">
        {code}
      </div>
      <label className="p-3 text-xs font-bold text-slate-600">
        {label}
        <textarea
          disabled={readonly}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          rows={rows}
          className="mt-1 w-full resize-y border border-slate-300 px-3 py-2 text-sm leading-6 disabled:bg-slate-100"
        />
      </label>
    </div>
  );
}

export default function NewEmrPage() {
  return (
    <Suspense fallback={<main className="p-8 text-center">차트 작성 준비 중</main>}>
      <NewEmrContent />
    </Suspense>
  );
}
