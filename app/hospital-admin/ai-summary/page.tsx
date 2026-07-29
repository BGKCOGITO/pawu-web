"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";

type RecordRow = {
  id: number;
  diagnosis: string;
  created_at: string;
  easy_explanation: string | null;
  pets: { name: string } | { name: string }[] | null;
};

function one<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

export default function HospitalAiSummaryPage() {
  const [records, setRecords] = useState<RecordRow[]>([]);
  const [message, setMessage] = useState("");

  async function load() {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return;

    let hospitalId: number | null = null;
    const { data: staff } = await supabase
      .from("hospital_staff")
      .select("hospital_id")
      .eq("user_id", auth.user.id)
      .eq("is_active", true)
      .maybeSingle();

    if (staff) hospitalId = Number(staff.hospital_id);

    if (!hospitalId) {
      const { data: admin } = await supabase
        .from("hospital_admins")
        .select("hospital_id")
        .eq("user_id", auth.user.id)
        .maybeSingle();
      if (admin) hospitalId = Number(admin.hospital_id);
    }

    if (!hospitalId) return;

    const { data } = await supabase
      .from("medical_records")
      .select("id, diagnosis, created_at, easy_explanation, pets(name)")
      .eq("hospital_id", hospitalId)
      .order("created_at", { ascending: false })
      .limit(30);

    setRecords((data ?? []) as unknown as RecordRow[]);
  }

  useEffect(() => {
    void load();
  }, []);

  async function summarize(id: number) {
    setMessage("");
    const { data: session } = await supabase.auth.getSession();
    const token = session.session?.access_token;
    if (!token) return;

    const response = await fetch("/api/ai/medical-summary", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ medicalRecordId: id }),
    });

    const result = (await response.json()) as { message?: string };
    setMessage(response.ok ? "보호자용 기록 요약을 갱신했습니다." : result.message ?? "요약 실패");
    if (response.ok) void load();
  }

  return (
    <main className="min-h-screen bg-gray-50 px-5 py-8 text-black">
      <div className="mx-auto max-w-5xl">
        <Link href="/hospital-admin" className="rounded-xl border bg-white px-4 py-2 text-sm">← 병원관리자</Link>

        <header className="mt-8">
          <p className="text-sm text-gray-500">PAWU AI Documentation</p>
          <h1 className="mt-2 text-3xl font-black">진료기록 보호자용 요약</h1>
          <p className="mt-3 text-sm text-gray-600">
            병원이 작성한 기록을 재구성합니다. 새로운 진단이나 치료 권고는 생성하지 않습니다.
          </p>
        </header>

        {message && <p className="mt-5 rounded-xl bg-white p-4 text-sm">{message}</p>}

        <div className="mt-8 space-y-4">
          {records.map((record) => (
            <article key={record.id} className="rounded-3xl border bg-white p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <strong className="text-lg">{one(record.pets)?.name ?? "환자"}</strong>
                  <p className="mt-1 text-sm text-gray-500">{record.created_at.slice(0, 10)}</p>
                </div>
                <button onClick={() => void summarize(record.id)} className="rounded-xl bg-black px-4 py-2 text-sm font-bold text-white">
                  요약 생성·갱신
                </button>
              </div>
              <p className="mt-4 text-sm font-semibold">진료 소견</p>
              <p className="mt-2 whitespace-pre-wrap text-sm text-gray-700">{record.diagnosis}</p>
              {record.easy_explanation && (
                <div className="mt-5 rounded-2xl bg-blue-50 p-4">
                  <p className="text-xs font-bold text-blue-700">현재 보호자용 요약</p>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-blue-950">{record.easy_explanation}</p>
                </div>
              )}
            </article>
          ))}
        </div>
      </div>
    </main>
  );
}
