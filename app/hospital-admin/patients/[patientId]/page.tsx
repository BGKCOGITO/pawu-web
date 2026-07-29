"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { hospitalAuthFetch } from "@/lib/hospital-auth-fetch";

function one(value: any) {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

export default function PatientDetailPage() {
  const params = useParams<{ patientId: string }>();
  const [data, setData] = useState<any>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const response = await hospitalAuthFetch(`/api/hospital/patients/${params.patientId}`);
        const result = await response.json();
        if (!response.ok) throw new Error(result.message);
        setData(result);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "환자 조회 실패");
      }
    }
    void load();
  }, [params.patientId]);

  if (!data) {
    return (
      <main className="p-6">
        <div className="border border-slate-300 bg-white p-10 text-center">
          {message || "환자 정보를 불러오는 중입니다."}
        </div>
      </main>
    );
  }

  const patient = data.patient;
  const pet = one(patient.pets);
  const records = patient.medical_records ?? [];
  const latest = data.latestReservation;

  return (
    <main className="p-4 lg:p-6">
      <div className="mx-auto max-w-[1500px]">
        <Link href="/hospital-admin/patients" className="text-sm font-bold text-slate-500">
          ← 환자 목록
        </Link>

        <section className="mt-4 grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
          <article className="border border-slate-300 bg-white p-6">
            <p className="text-xs font-bold text-slate-400">{patient.patient_number}</p>
            <h2 className="mt-2 text-3xl font-bold">{pet?.name}</h2>
            <p className="mt-2 text-sm text-slate-500">
              {pet?.species || "-"} · {pet?.breed || "품종 미입력"}
            </p>

            <dl className="mt-6 grid gap-4 text-sm sm:grid-cols-2">
              <div><dt className="text-slate-400">성별</dt><dd className="mt-1 font-bold">{pet?.gender || "미입력"}</dd></div>
              <div><dt className="text-slate-400">몸무게</dt><dd className="mt-1 font-bold">{pet?.weight_kg != null ? `${pet.weight_kg}kg` : "미입력"}</dd></div>
              <div><dt className="text-slate-400">보호자</dt><dd className="mt-1 font-bold">{latest?.guardian_name || "-"}</dd></div>
              <div><dt className="text-slate-400">연락처</dt><dd className="mt-1 font-bold">{latest?.phone || "-"}</dd></div>
            </dl>

            {latest?.id && (
              <Link
                href={`/hospital-admin/reservations/${latest.id}`}
                className="mt-6 block bg-slate-950 px-4 py-3 text-center font-bold text-white"
              >
                최근 예약 열기
              </Link>
            )}
          </article>

          <article className="border border-slate-300 bg-white p-6">
            <h3 className="text-xl font-bold">진료 기록</h3>
            <div className="mt-5 space-y-3">
              {records.length === 0 ? (
                <p className="border border-dashed border-slate-300 p-8 text-center text-slate-500">
                  아직 작성된 전자차트가 없습니다.
                </p>
              ) : (
                records
                  .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                  .map((record: any) => (
                    <Link
                      key={record.id}
                      href={`/hospital-admin/emr/${record.id}`}
                      className="block border border-slate-200 p-4 hover:border-slate-950"
                    >
                      <div className="flex justify-between gap-3">
                        <div>
                          <p className="font-bold">{record.chief_complaint || "주호소 미입력"}</p>
                          <p className="mt-1 text-sm text-slate-500">{record.diagnosis || "진단 미입력"}</p>
                        </div>
                        <span className="text-xs font-bold">{record.status}</span>
                      </div>
                    </Link>
                  ))
              )}
            </div>
          </article>
        </section>
      </div>
    </main>
  );
}
