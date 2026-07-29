"use client";

import { useEffect, useState } from "react";
import { hospitalAuthFetch } from "@/lib/hospital-auth-fetch";

type Draft = {
  guardian_summary: string;
  care_instructions: string;
  medication_instructions: string;
  warning_signs: string;
  next_visit_recommendation: string;
  status: "draft" | "approved";
  provider: string;
  model: string | null;
  generated_at: string;
  approved_at: string | null;
};

const emptyDraft: Draft = {
  guardian_summary: "",
  care_instructions: "",
  medication_instructions: "",
  warning_signs: "",
  next_visit_recommendation: "",
  status: "draft",
  provider: "template",
  model: null,
  generated_at: "",
  approved_at: null,
};

export default function AiMedicalAssistantPanel({
  recordId,
  onApproved,
}: {
  recordId: number;
  onApproved: () => Promise<void> | void;
}) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");

  async function load() {
    const response = await hospitalAuthFetch(`/api/hospital/medical-records/${recordId}/ai-assistant`);
    const result = await response.json();
    if (response.ok) setDraft(result.draft);
  }

  useEffect(() => { void load(); }, [recordId]);

  async function generate() {
    setWorking(true); setMessage("");
    try {
      const response = await hospitalAuthFetch(`/api/hospital/medical-records/${recordId}/ai-assistant`, { method: "POST" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      setDraft(result.draft);
      if (result.draft.provider === "openai") {
        const totalTokens = result.generation?.usage?.totalTokens;
        setMessage(`OpenAI 초안을 생성했습니다.${totalTokens ? ` 사용 토큰: ${totalTokens.toLocaleString()}개` : ""}`);
      } else {
        const reason = result.generation?.fallbackReason;
        setMessage(`안전 템플릿으로 전환했습니다.${reason ? ` 사유: ${reason}` : ""}`);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "초안 생성에 실패했습니다.");
    } finally { setWorking(false); }
  }

  function change(key: keyof Draft, value: string) {
    setDraft((current) => ({ ...(current ?? emptyDraft), [key]: value }));
  }

  async function save(action: "save" | "approve") {
    if (!draft) return;
    if (action === "approve" && !window.confirm("검토한 내용을 보호자용 진료 안내에 적용할까요?")) return;
    setWorking(true); setMessage("");
    try {
      const response = await hospitalAuthFetch(`/api/hospital/medical-records/${recordId}/ai-assistant`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action,
          guardianSummary: draft.guardian_summary,
          careInstructions: draft.care_instructions,
          medicationInstructions: draft.medication_instructions,
          warningSigns: draft.warning_signs,
          nextVisitRecommendation: draft.next_visit_recommendation,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      setDraft(result.draft);
      setMessage(action === "approve" ? "의료진 승인 완료. 보호자용 진료 안내에 반영했습니다." : "검토 중인 초안을 저장했습니다.");
      if (action === "approve") await onApproved();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "저장에 실패했습니다.");
    } finally { setWorking(false); }
  }

  return (
    <article className="border border-violet-300 bg-violet-50/50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black text-violet-700">PAWU AI MEDICAL ASSISTANT · 의료진 검토 필수</p>
          <h3 className="mt-1 text-base font-bold">보호자 설명·퇴원·복약 안내 초안</h3>
          <p className="mt-1 text-xs leading-5 text-slate-600">차트와 처방에 입력된 내용만 정리하며 진단·처방을 새로 만들지 않습니다. 승인 전에는 보호자에게 공개되지 않습니다.</p>
        </div>
        <div className="flex items-center gap-2">
          {draft && <span className={`border px-2 py-1 text-xs font-bold ${draft.status === "approved" ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-amber-300 bg-amber-50 text-amber-800"}`}>{draft.status === "approved" ? "의료진 승인" : "검토 중"}</span>}
          <button type="button" disabled={working} onClick={() => void generate()} className="bg-violet-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{working ? "처리 중..." : draft ? "초안 다시 생성" : "AI 초안 생성"}</button>
        </div>
      </div>

      {message && <p className="mt-3 border border-violet-200 bg-white p-3 text-sm text-violet-900">{message}</p>}

      {!draft ? (
        <div className="mt-4 border border-dashed border-violet-300 bg-white p-5 text-center text-sm text-slate-600">SOAP·진단·처방을 입력한 뒤 <strong>AI 초안 생성</strong>을 눌러 주세요.</div>
      ) : (
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {[
            ["guardian_summary", "보호자용 오늘 진료 설명", 7],
            ["care_instructions", "가정 관리·퇴원 안내", 7],
            ["medication_instructions", "복약 안내", 7],
            ["warning_signs", "병원에 연락해야 할 증상", 7],
            ["next_visit_recommendation", "다음 방문 권장", 3],
          ].map(([key, label, rows], index) => (
            <label key={String(key)} className={index === 0 ? "lg:col-span-2" : ""}>
              <span className="text-sm font-bold">{label}</span>
              <textarea value={String(draft[key as keyof Draft] ?? "")} onChange={(event) => change(key as keyof Draft, event.target.value)} rows={Number(rows)} className="mt-1.5 w-full resize-y border border-slate-300 bg-white px-3 py-2 text-sm leading-6" />
            </label>
          ))}
          <div className="lg:col-span-2 flex flex-wrap items-center justify-between gap-3 border-t border-violet-200 pt-3">
            <p className="text-xs text-slate-500">생성 방식: {draft.provider === "openai" ? `OpenAI ${draft.model ?? ""}` : "안전 템플릿"} · 승인하면 기존 보호자 안내 칸에 복사됩니다.</p>
            <div className="flex gap-2">
              <button type="button" disabled={working} onClick={() => void save("save")} className="border border-violet-700 bg-white px-4 py-2 text-sm font-bold text-violet-800 disabled:opacity-50">검토 초안 저장</button>
              <button type="button" disabled={working} onClick={() => void save("approve")} className="bg-emerald-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">의료진 승인·적용</button>
            </div>
          </div>
        </div>
      )}
    </article>
  );
}
