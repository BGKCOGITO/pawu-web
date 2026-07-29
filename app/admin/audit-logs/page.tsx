"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";

type Log = {
  id: number;
  actor_type: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
};

export default function AuditLogPage() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function load() {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      if (!token) return;

      const response = await fetch("/api/platform/audit-logs?scope=admin", {
        headers: { authorization: `Bearer ${token}` },
      });
      const result = await response.json();
      if (!response.ok) {
        setMessage(result.message ?? "활동 기록을 불러오지 못했습니다.");
        return;
      }
      setLogs(result.logs ?? []);
    }
    void load();
  }, []);

  return (
    <main className="min-h-screen bg-gray-50 px-5 py-8 text-black">
      <div className="mx-auto max-w-6xl">
        <Link href="/admin/operations" className="rounded-xl border bg-white px-4 py-2 text-sm">← 돌아가기</Link>
        <h1 className="mt-8 text-3xl font-black">활동 기록</h1>
        <p className="mt-2 text-sm text-gray-600">주요 데이터 변경과 운영 작업을 추적합니다.</p>
        {message && <p className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-700">{message}</p>}

        <div className="mt-6 overflow-hidden rounded-3xl border bg-white">
          <table className="w-full min-w-[850px] text-left text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="p-4">시간</th>
                <th className="p-4">주체</th>
                <th className="p-4">작업</th>
                <th className="p-4">대상</th>
                <th className="p-4">상세</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-t align-top">
                  <td className="p-4 whitespace-nowrap">{log.created_at.slice(0, 19).replace("T", " ")}</td>
                  <td className="p-4">{log.actor_type}</td>
                  <td className="p-4 font-semibold">{log.action}</td>
                  <td className="p-4">{log.entity_type}{log.entity_id ? ` #${log.entity_id}` : ""}</td>
                  <td className="p-4 text-xs text-gray-500">{JSON.stringify(log.details ?? {})}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!logs.length && <p className="p-8 text-center text-gray-500">기록이 없습니다.</p>}
        </div>
      </div>
    </main>
  );
}
