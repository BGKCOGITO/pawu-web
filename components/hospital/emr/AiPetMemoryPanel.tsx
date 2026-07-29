"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { hospitalAuthFetch } from "@/lib/hospital-auth-fetch";

type TimelineItem = { date: string; title: string; detail: string; recordId: number };
type Pattern = { label: string; evidence: string; recordIds: number[] };
type Memory = {
  overview: string;
  timeline: TimelineItem[];
  patterns: Pattern[];
  cautions: string[];
  record_count: number;
  provider: string;
  model: string | null;
  generated_at: string;
};

export default function AiPetMemoryPanel({ recordId }: { recordId: number }) {
  const [memory, setMemory] = useState<Memory | null>(null);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");

  async function load() {
    try {
      const response = await hospitalAuthFetch(`/api/hospital/medical-records/${recordId}/ai-memory`);
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      setMemory(result.memory);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "AI Memory 조회에 실패했습니다.");
    }
  }

  useEffect(() => { void load(); }, [recordId]);

  async function generate() {
    setWorking(true);
    setMessage("");
    try {
      const response = await hospitalAuthFetch(`/api/hospital/medical-records/${recordId}/ai-memory`, { method: "POST" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      setMemory(result.memory);
      const tokens = result.generation?.usage?.totalTokens;
      setMessage(result.memory.provider === "openai"
        ? `과거 기록 정리를 완료했습니다.${tokens ? ` 사용 토큰: ${Number(tokens).toLocaleString()}개` : ""}`
        : `안전 템플릿으로 정리했습니다.${result.generation?.fallbackReason ? ` 사유: ${result.generation.fallbackReason}` : ""}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "AI Memory 생성에 실패했습니다.");
    } finally {
      setWorking(false);
    }
  }

  return (
    <article className="border border-indigo-300 bg-indigo-50/50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black text-indigo-700">PAWU AI MEMORY · 의료진 전용 참고자료</p>
          <h3 className="mt-1 text-base font-bold">환자 과거 기록 타임라인·반복 기록</h3>
          <p className="mt-1 text-xs leading-5 text-slate-600">
            이 병원에 저장된 과거 차트만 정리합니다. 진단·처방·검사 권고를 새로 만들지 않으며 보호자에게 공개되지 않습니다.
          </p>
        </div>
        <button
          type="button"
          disabled={working}
          onClick={() => void generate()}
          className="bg-indigo-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
        >
          {working ? "기록 정리 중..." : memory ? "AI Memory 다시 생성" : "AI Memory 생성"}
        </button>
      </div>

      {message && <p className="mt-3 border border-indigo-200 bg-white p-3 text-sm text-indigo-900">{message}</p>}

      {!memory ? (
        <div className="mt-4 border border-dashed border-indigo-300 bg-white p-5 text-center text-sm text-slate-600">
          환자의 기존 차트를 시간순으로 정리하려면 <strong>AI Memory 생성</strong>을 눌러 주세요.
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          <div className="border border-indigo-200 bg-white p-4">
            <p className="whitespace-pre-wrap text-sm leading-6 text-slate-800">{memory.overview}</p>
            <p className="mt-2 text-xs text-slate-500">
              반영 기록 {memory.record_count}건 · {memory.provider === "openai" ? `OpenAI ${memory.model ?? ""}` : "안전 템플릿"} · {new Date(memory.generated_at).toLocaleString("ko-KR")}
            </p>
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
            <section className="border border-slate-300 bg-white p-4">
              <h4 className="text-sm font-bold">의료기록 타임라인</h4>
              <div className="mt-3 max-h-[430px] space-y-3 overflow-y-auto pr-1">
                {(memory.timeline ?? []).length === 0 ? (
                  <p className="text-sm text-slate-500">표시할 타임라인이 없습니다.</p>
                ) : memory.timeline.map((item) => (
                  <div key={`${item.recordId}-${item.date}`} className="border-l-2 border-indigo-600 pl-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs font-bold text-indigo-700">{item.date || "날짜 미상"}</p>
                      <Link href={`/hospital-admin/emr/${item.recordId}`} className="text-xs font-bold text-slate-500 underline">원본 차트 #{item.recordId}</Link>
                    </div>
                    <p className="mt-1 text-sm font-bold">{item.title}</p>
                    <p className="mt-1 whitespace-pre-wrap text-xs leading-5 text-slate-600">{item.detail}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="space-y-3">
              <div className="border border-amber-300 bg-amber-50 p-4">
                <h4 className="text-sm font-bold text-amber-900">반복 기록</h4>
                <div className="mt-3 space-y-2">
                  {(memory.patterns ?? []).length === 0 ? (
                    <p className="text-sm text-amber-900/70">현재 기록에서 명확한 반복 항목이 확인되지 않았습니다.</p>
                  ) : memory.patterns.map((pattern, index) => (
                    <div key={`${pattern.label}-${index}`} className="border border-amber-200 bg-white p-3">
                      <p className="text-sm font-bold">{pattern.label}</p>
                      <p className="mt-1 text-xs leading-5 text-slate-600">{pattern.evidence}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border border-slate-300 bg-white p-4">
                <h4 className="text-sm font-bold">안전 확인</h4>
                <ul className="mt-2 space-y-2 text-xs leading-5 text-slate-600">
                  {(memory.cautions ?? []).map((item, index) => <li key={index}>• {item}</li>)}
                </ul>
              </div>
            </section>
          </div>
        </div>
      )}
    </article>
  );
}
