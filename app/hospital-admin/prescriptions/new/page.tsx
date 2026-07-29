"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { FormEvent } from "react";
import { supabase } from "../../../../lib/supabase";

export default function NewPrescriptionPage() {
  return (
    <Suspense fallback={<main className="p-6 text-center text-slate-500">처방전 화면을 불러오는 중입니다.</main>}>
      <NewPrescriptionContent />
    </Suspense>
  );
}

function NewPrescriptionContent() {
  const searchParams = useSearchParams();
  const [petId, setPetId] = useState(searchParams.get("petId") ?? "");
  const [emrRecordId, setEmrRecordId] = useState(searchParams.get("emrRecordId") ?? "");
  const [reservationId, setReservationId] = useState(searchParams.get("reservationId") ?? "");
  const [diagnosisSummary, setDiagnosisSummary] = useState("");
  const [guardianNote, setGuardianNote] = useState("");
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState("");
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return;

    const response = await fetch("/api/hospital/prescriptions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        petId: Number(petId),
        emrRecordId: emrRecordId ? Number(emrRecordId) : null,
        reservationId: reservationId ? Number(reservationId) : null,
        diagnosisSummary,
        guardianNote,
        startDate,
        endDate,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      setMessage(result.message ?? "처방전을 만들지 못했습니다.");
      return;
    }

    window.location.href = `/hospital-admin/prescriptions/${result.prescriptionId}`;
  }

  return (
    <main className="p-4 lg:p-6">
      <div className="mx-auto max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          New Prescription
        </p>
        <h1 className="mt-1 text-2xl font-bold">새 처방전</h1>

        {message && (
          <div className="mt-4 border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
            {message}
          </div>
        )}

        <form onSubmit={submit} className="mt-4 border border-slate-300 bg-white">
          <div className="grid gap-4 p-5 md:grid-cols-3">
            <Field label="환자 ID" value={petId} onChange={(v) => setPetId(v.replace(/[^\d]/g, ""))} required />
            <Field label="전자차트 ID" value={emrRecordId} onChange={(v) => setEmrRecordId(v.replace(/[^\d]/g, ""))} />
            <Field label="예약 ID" value={reservationId} onChange={(v) => setReservationId(v.replace(/[^\d]/g, ""))} />

            <label className="md:col-span-3 text-sm font-semibold">
              진단·처방 목적
              <textarea
                value={diagnosisSummary}
                onChange={(event) => setDiagnosisSummary(event.target.value)}
                rows={3}
                className="mt-1 w-full border border-slate-300 px-3 py-2"
              />
            </label>

            <label className="md:col-span-3 text-sm font-semibold">
              보호자 복약 안내 초안
              <textarea
                value={guardianNote}
                onChange={(event) => setGuardianNote(event.target.value)}
                rows={4}
                className="mt-1 w-full border border-slate-300 px-3 py-2"
              />
            </label>

            <Field label="복약 시작일" value={startDate} onChange={setStartDate} type="date" />
            <Field label="복약 종료일" value={endDate} onChange={setEndDate} type="date" />
          </div>

          <div className="border-t border-slate-300 bg-slate-50 p-4 text-right">
            <button className="border border-slate-900 bg-slate-900 px-5 py-2 text-sm font-bold text-white">
              처방전 생성
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}

function Field({
  label,
  value,
  onChange,
  required = false,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  type?: string;
}) {
  return (
    <label className="text-sm font-semibold">
      {label}
      <input
        type={type}
        required={required}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full border border-slate-300 px-3 py-2"
      />
    </label>
  );
}
