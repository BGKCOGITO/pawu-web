"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { hospitalAuthFetch } from "@/lib/hospital-auth-fetch";

function one(value: any) {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

export default function MedicalRecordsPage() {
  const [records, setRecords] = useState<any[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const response = await hospitalAuthFetch("/api/hospital/medical-records");
        const result = await response.json();
        if (!response.ok) throw new Error(result.message);
        setRecords(result.records ?? []);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "진료 기록 조회 실패");
      }
    }
    void load();
  }, []);

  return (
    <main className="p-4 lg:p-6">
      <div className="mx-auto max-w-[1500px]">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Medical History
        </p>
        <h2 className="mt-1 text-2xl font-bold">진료 기록</h2>

        {message && <div className="mt-4 border border-red-300 bg-red-50 p-4 text-red-700">{message}</div>}

        <section className="mt-5 overflow-hidden border border-slate-300 bg-white">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="bg-slate-100 text-xs text-slate-600">
              <tr>
                <th className="px-4 py-3">작성일</th>
                <th className="px-4 py-3">환자</th>
                <th className="px-4 py-3">주호소</th>
                <th className="px-4 py-3">진단</th>
                <th className="px-4 py-3">상태</th>
                <th className="px-4 py-3">열기</th>
              </tr>
            </thead>
            <tbody>
              {records.map((record) => {
                const patient = one(record.hospital_patients);
                const pet = one(patient?.pets);
                return (
                  <tr key={record.id} className="border-t border-slate-200">
                    <td className="px-4 py-4">{new Date(record.created_at).toLocaleString("ko-KR")}</td>
                    <td className="px-4 py-4 font-bold">{pet?.name || "-"}</td>
                    <td className="px-4 py-4">{record.chief_complaint || "-"}</td>
                    <td className="px-4 py-4">{record.diagnosis || "-"}</td>
                    <td className="px-4 py-4">{record.status}</td>
                    <td className="px-4 py-4">
                      <Link
                        href={`/hospital-admin/emr/${record.id}`}
                        className="border border-slate-950 px-3 py-2 text-xs font-bold"
                      >
                        차트 열기
                      </Link>
                    </td>
                  </tr>
                );
              })}
              {records.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-16 text-center text-slate-500">
                    작성된 진료 기록이 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      </div>
    </main>
  );
}
