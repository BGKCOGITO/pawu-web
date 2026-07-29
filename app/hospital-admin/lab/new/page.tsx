"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { FormEvent } from "react";
import { supabase } from "../../../../lib/supabase";

const categories = ["혈액검사", "소변검사", "분변검사", "세포검사", "X-ray", "초음파", "CT", "MRI", "기타"];

export default function NewLabOrderPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-slate-50 p-8 text-center text-gray-500">검사 지시 화면을 불러오는 중입니다.</main>}>
      <NewLabOrderContent />
    </Suspense>
  );
}

function NewLabOrderContent() {
  const searchParams = useSearchParams();
  const [petId, setPetId] = useState(searchParams.get("petId") ?? "");
  const [emrRecordId, setEmrRecordId] = useState(searchParams.get("emrRecordId") ?? "");
  const [reservationId, setReservationId] = useState(searchParams.get("reservationId") ?? "");
  const [category, setCategory] = useState("혈액검사");
  const [testName, setTestName] = useState("");
  const [priority, setPriority] = useState("routine");
  const [specimenType, setSpecimenType] = useState("");
  const [clinicalNote, setClinicalNote] = useState("");
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return;

    const response = await fetch("/api/hospital/lab/orders", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        petId: Number(petId),
        emrRecordId: emrRecordId ? Number(emrRecordId) : null,
        reservationId: reservationId ? Number(reservationId) : null,
        category,
        testName,
        priority,
        specimenType,
        clinicalNote,
      }),
    });

    const result = await response.json();
    if (!response.ok) {
      setMessage(result.message ?? "검사 지시를 생성하지 못했습니다.");
      return;
    }

    window.location.href = `/hospital-admin/lab/${result.orderId}`;
  }

  return (
    <main className="min-h-screen bg-slate-50 px-5 py-8 text-black">
      <div className="mx-auto max-w-2xl">
        <Link href="/hospital-admin/lab" className="rounded-xl border bg-white px-4 py-2 text-sm">← 검사 목록</Link>
        <h1 className="mt-8 text-3xl font-black">새 검사 지시</h1>
        {message && <p className="mt-5 rounded-2xl bg-white p-4 text-sm">{message}</p>}

        <form onSubmit={submit} className="mt-6 space-y-4 rounded-3xl border bg-white p-6">
          <Field label="환자 ID" value={petId} onChange={(value) => setPetId(value.replace(/[^\d]/g, ""))} required />
          <Field label="전자차트 ID" value={emrRecordId} onChange={(value) => setEmrRecordId(value.replace(/[^\d]/g, ""))} />
          <Field label="예약 ID" value={reservationId} onChange={(value) => setReservationId(value.replace(/[^\d]/g, ""))} />

          <label className="block text-sm font-bold">
            검사 분류
            <select value={category} onChange={(event) => setCategory(event.target.value)} className="mt-2 w-full rounded-xl border p-3">
              {categories.map((value) => <option key={value}>{value}</option>)}
            </select>
          </label>

          <Field label="검사명" value={testName} onChange={setTestName} required />

          <label className="block text-sm font-bold">
            우선순위
            <select value={priority} onChange={(event) => setPriority(event.target.value)} className="mt-2 w-full rounded-xl border p-3">
              <option value="routine">일반</option>
              <option value="urgent">긴급</option>
              <option value="stat">즉시</option>
            </select>
          </label>

          <Field label="검체 종류" value={specimenType} onChange={setSpecimenType} />

          <label className="block text-sm font-bold">
            임상 메모
            <textarea value={clinicalNote} onChange={(event) => setClinicalNote(event.target.value)} rows={4} className="mt-2 w-full rounded-xl border p-3" />
          </label>

          <button className="w-full rounded-xl bg-black p-4 font-bold text-white">검사 지시 생성</button>
        </form>
      </div>
    </main>
  );
}

function Field({ label, value, onChange, required = false }: { label: string; value: string; onChange: (value: string) => void; required?: boolean }) {
  return (
    <label className="block text-sm font-bold">
      {label}
      <input required={required} value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 w-full rounded-xl border p-3" />
    </label>
  );
}
