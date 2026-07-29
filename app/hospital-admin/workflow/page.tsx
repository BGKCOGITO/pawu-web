"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabase";

type Row = {
  id: number;
  guardian_name: string;
  pet_name: string;
  reservation_date: string;
  reservation_time: string;
  visit_reason: string;
  status: string;
  pets: { name: string } | { name: string }[] | null;
};

const columns = [
  { status: "approved", title: "예약 확정", description: "방문 전" },
  { status: "arrived", title: "접수·도착", description: "대기 중" },
  { status: "in_progress", title: "진료 중", description: "수의사 진료" },
  { status: "payment_pending", title: "결제 대기", description: "진료 종료" },
  { status: "completed", title: "완료", description: "기록 보관" },
];

function one<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

export default function HospitalWorkflowPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [hospitalName, setHospitalName] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  async function load() {
    setLoading(true);
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) { setLoading(false); return; }

    let hospitalId: number | null = null;
    const { data: staff } = await supabase
      .from("hospital_staff")
      .select("hospital_id, hospitals(name)")
      .eq("user_id", auth.user.id)
      .eq("is_active", true)
      .maybeSingle();

    if (staff) {
      hospitalId = Number(staff.hospital_id);
      setHospitalName(one(staff.hospitals as {name:string}|{name:string}[]|null)?.name ?? "");
    } else {
      const { data: admin } = await supabase
        .from("hospital_admins")
        .select("hospital_id, hospitals(name)")
        .eq("user_id", auth.user.id)
        .maybeSingle();
      if (admin) {
        hospitalId = Number(admin.hospital_id);
        setHospitalName(one(admin.hospitals as {name:string}|{name:string}[]|null)?.name ?? "");
      }
    }

    if (!hospitalId) { setLoading(false); return; }

    const today = new Date().toISOString().slice(0,10);
    const { data } = await supabase
      .from("reservations")
      .select("id, guardian_name, pet_name, reservation_date, reservation_time, visit_reason, status, pets(name)")
      .eq("hospital_id", hospitalId)
      .eq("reservation_date", today)
      .in("status", ["approved","arrived","in_progress","payment_pending","completed"])
      .order("reservation_time");

    setRows((data ?? []) as unknown as Row[]);
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  const counts = useMemo(() => Object.fromEntries(columns.map(c => [c.status, rows.filter(r => r.status === c.status).length])), [rows]);

  async function move(id: number, status: string) {
    const { data: session } = await supabase.auth.getSession();
    const token = session.session?.access_token;
    if (!token) return;
    const response = await fetch("/api/hospital/workflow", {
      method: "PATCH",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ reservationId: id, status }),
    });
    const result = await response.json() as {ok?:boolean;message?:string};
    if (!response.ok) { setMessage(result.message ?? "상태를 변경하지 못했습니다."); return; }
    setRows(v => v.map(row => row.id === id ? {...row, status} : row));
    setMessage("업무 상태를 변경했습니다.");
  }

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-6 text-black">
      <div className="mx-auto max-w-[1600px]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-slate-500">{hospitalName || "PAWU Hospital"}</p>
            <h1 className="text-3xl font-black">오늘의 병원 업무 보드</h1>
          </div>
          <div className="flex gap-2">
            <Link href="/hospital-admin" className="rounded-xl border bg-white px-4 py-2 text-sm">대시보드</Link>
            <Link href="/hospital-admin/medical-records" className="rounded-xl bg-black px-4 py-2 text-sm text-white">진료기록</Link>
          </div>
        </div>

        {message && <p className="mt-4 rounded-xl bg-white p-3 text-sm">{message}</p>}

        <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {columns.map(c => (
            <div key={c.status} className="rounded-2xl bg-white p-4">
              <p className="text-xs text-slate-500">{c.description}</p>
              <div className="mt-1 flex items-end justify-between"><strong>{c.title}</strong><span className="text-2xl font-black">{counts[c.status] ?? 0}</span></div>
            </div>
          ))}
        </section>

        {loading ? <p className="mt-8">불러오는 중...</p> : (
          <section className="mt-6 grid min-w-[1200px] grid-cols-5 gap-4 overflow-x-auto pb-4">
            {columns.map((column, columnIndex) => (
              <div key={column.status} className="min-h-[520px] rounded-3xl border bg-slate-50 p-3">
                <h2 className="px-2 py-2 font-bold">{column.title}</h2>
                <div className="space-y-3">
                  {rows.filter(r => r.status === column.status).map(row => (
                    <article key={row.id} className="rounded-2xl border bg-white p-4 shadow-sm">
                      <div className="flex justify-between gap-3">
                        <strong>{one(row.pets)?.name ?? row.pet_name}</strong>
                        <span className="text-xs text-slate-500">{row.reservation_time.slice(0,5)}</span>
                      </div>
                      <p className="mt-2 text-sm">{row.guardian_name}</p>
                      <p className="mt-1 line-clamp-2 text-xs text-slate-500">{row.visit_reason}</p>
                      <div className="mt-4 grid gap-2">
                        {columnIndex > 0 && <button onClick={() => void move(row.id, columns[columnIndex-1].status)} className="rounded-lg border px-3 py-2 text-xs">← 이전 단계</button>}
                        {columnIndex < columns.length - 1 && <button onClick={() => void move(row.id, columns[columnIndex+1].status)} className="rounded-lg bg-black px-3 py-2 text-xs text-white">다음 단계 →</button>}
                        <Link href={`/hospital-admin/patients?pet=${row.id}`} className="rounded-lg bg-blue-50 px-3 py-2 text-center text-xs text-blue-700">환자 차트</Link>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}
