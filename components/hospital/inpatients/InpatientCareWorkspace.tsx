"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { hospitalAuthFetch } from "@/lib/hospital-auth-fetch";

type CarePlan = {
  id: number;
  plan_type: string;
  title: string;
  instruction: string | null;
  start_at: string;
  end_at: string | null;
  frequency: string | null;
  scheduled_times: unknown;
  status: string;
};

function localDateTimeNow() {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

function typeLabel(value: string) {
  return {
    medication: "투약",
    fluid: "수액",
    feeding: "식사",
    monitoring: "모니터링",
    wound_care: "상처 관리",
    exercise: "운동",
    test: "검사",
    procedure: "처치",
    other: "기타",
  }[value] ?? value;
}

function statusLabel(value: string) {
  return {
    planned: "예정",
    active: "진행 중",
    paused: "일시중지",
    completed: "완료",
    cancelled: "취소",
  }[value] ?? value;
}

function eventTitle(type: string) {
  return {
    meal: "식사 기록",
    water: "음수 기록",
    medication: "투약 기록",
    injection: "주사 기록",
    iv: "수액 기록",
    urination: "배뇨 기록",
    defecation: "배변 기록",
    procedure: "처치 기록",
  }[type] ?? "입원 기록";
}

const emptyPlan = {
  planType: "medication",
  title: "",
  instruction: "",
  startAt: localDateTimeNow(),
  endAt: "",
  frequency: "",
  scheduledTimes: "",
  status: "active",
};

const emptyEvent = {
  eventType: "medication",
  occurredAt: localDateTimeNow(),
  title: "투약 기록",
  content: "",
  amountValue: "",
  amountUnit: "",
  statusValue: "completed",
  abnormalFlag: false,
  requiresFollowUp: false,
};

export default function InpatientCareWorkspace({ hospitalizationId }: { hospitalizationId: string }) {
  const [plans, setPlans] = useState<CarePlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [planForm, setPlanForm] = useState(emptyPlan);
  const [eventForm, setEventForm] = useState(emptyEvent);

  async function loadPlans() {
    setLoading(true);
    try {
      const response = await hospitalAuthFetch(
        `/api/hospital/hospitalizations/${hospitalizationId}/care-plans`,
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      setPlans(result.carePlans ?? []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "치료 계획을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadPlans();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hospitalizationId]);

  async function createPlan(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const response = await hospitalAuthFetch(
        `/api/hospital/hospitalizations/${hospitalizationId}/care-plans`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...planForm,
            startAt: planForm.startAt ? new Date(planForm.startAt).toISOString() : null,
            endAt: planForm.endAt ? new Date(planForm.endAt).toISOString() : null,
            scheduledTimes: planForm.scheduledTimes
              .split(",")
              .map((value) => value.trim())
              .filter(Boolean),
          }),
        },
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      setPlanForm({ ...emptyPlan, startAt: localDateTimeNow() });
      setMessage(result.message);
      await loadPlans();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "치료 계획 등록 실패");
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(planId: number, status: string) {
    setSaving(true);
    setMessage("");
    try {
      const response = await hospitalAuthFetch(
        `/api/hospital/hospitalizations/${hospitalizationId}/care-plans/${planId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        },
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      setMessage(result.message);
      await loadPlans();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "상태 변경 실패");
    } finally {
      setSaving(false);
    }
  }

  async function deletePlan(planId: number) {
    if (!window.confirm("이 치료 계획을 삭제할까요?")) return;
    setSaving(true);
    setMessage("");
    try {
      const response = await hospitalAuthFetch(
        `/api/hospital/hospitalizations/${hospitalizationId}/care-plans/${planId}`,
        { method: "DELETE" },
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      setMessage(result.message);
      await loadPlans();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "삭제 실패");
    } finally {
      setSaving(false);
    }
  }

  async function createEvent(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const response = await hospitalAuthFetch(
        `/api/hospital/hospitalizations/${hospitalizationId}/events`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...eventForm,
            occurredAt: eventForm.occurredAt
              ? new Date(eventForm.occurredAt).toISOString()
              : null,
          }),
        },
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      setEventForm({ ...emptyEvent, occurredAt: localDateTimeNow() });
      setMessage(`${result.message} 타임라인 새로고침 후 확인할 수 있습니다.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "입원 기록 저장 실패");
    } finally {
      setSaving(false);
    }
  }

  const activeCount = useMemo(
    () => plans.filter((item) => item.status === "active" || item.status === "planned").length,
    [plans],
  );

  return (
    <section className="mt-5 border border-slate-300 bg-white">
      <div className="border-b border-slate-300 px-4 py-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
              Inpatient Care Schedule
            </p>
            <h2 className="mt-1 text-xl font-black">처치·투약·수액·식사 관리</h2>
          </div>
          <p className="text-sm font-bold text-slate-600">
            진행 중 계획 {activeCount}건 · 전체 {plans.length}건
          </p>
        </div>
      </div>

      {message && (
        <div className="border-b border-slate-300 bg-slate-50 px-4 py-3 text-sm font-semibold">
          {message}
        </div>
      )}

      <div className="grid gap-0 xl:grid-cols-2">
        <div className="border-b border-slate-300 p-4 xl:border-b-0 xl:border-r">
          <h3 className="font-black">치료 계획 등록</h3>
          <form onSubmit={createPlan} className="mt-4 grid gap-3 sm:grid-cols-2">
            <label>
              <span className="mb-1 block text-xs font-bold">계획 종류</span>
              <select
                value={planForm.planType}
                onChange={(event) => setPlanForm((current) => ({ ...current, planType: event.target.value }))}
                className="w-full border border-slate-300 px-3 py-2"
              >
                <option value="medication">투약</option>
                <option value="fluid">수액</option>
                <option value="feeding">식사</option>
                <option value="monitoring">모니터링</option>
                <option value="wound_care">상처 관리</option>
                <option value="exercise">운동</option>
                <option value="test">검사</option>
                <option value="procedure">처치</option>
                <option value="other">기타</option>
              </select>
            </label>
            <label>
              <span className="mb-1 block text-xs font-bold">상태</span>
              <select
                value={planForm.status}
                onChange={(event) => setPlanForm((current) => ({ ...current, status: event.target.value }))}
                className="w-full border border-slate-300 px-3 py-2"
              >
                <option value="planned">예정</option>
                <option value="active">진행 중</option>
              </select>
            </label>
            <label className="sm:col-span-2">
              <span className="mb-1 block text-xs font-bold">계획명</span>
              <input
                required
                value={planForm.title}
                onChange={(event) => setPlanForm((current) => ({ ...current, title: event.target.value }))}
                placeholder="예: 항생제 투약, 유지 수액, 저지방식 급여"
                className="w-full border border-slate-300 px-3 py-2"
              />
            </label>
            <label>
              <span className="mb-1 block text-xs font-bold">시작 시각</span>
              <input
                type="datetime-local"
                value={planForm.startAt}
                onChange={(event) => setPlanForm((current) => ({ ...current, startAt: event.target.value }))}
                className="w-full border border-slate-300 px-3 py-2"
              />
            </label>
            <label>
              <span className="mb-1 block text-xs font-bold">종료 시각</span>
              <input
                type="datetime-local"
                value={planForm.endAt}
                onChange={(event) => setPlanForm((current) => ({ ...current, endAt: event.target.value }))}
                className="w-full border border-slate-300 px-3 py-2"
              />
            </label>
            <label>
              <span className="mb-1 block text-xs font-bold">반복 주기</span>
              <input
                value={planForm.frequency}
                onChange={(event) => setPlanForm((current) => ({ ...current, frequency: event.target.value }))}
                placeholder="예: 8시간마다, 하루 2회"
                className="w-full border border-slate-300 px-3 py-2"
              />
            </label>
            <label>
              <span className="mb-1 block text-xs font-bold">예정 시간</span>
              <input
                value={planForm.scheduledTimes}
                onChange={(event) => setPlanForm((current) => ({ ...current, scheduledTimes: event.target.value }))}
                placeholder="09:00, 17:00"
                className="w-full border border-slate-300 px-3 py-2"
              />
            </label>
            <label className="sm:col-span-2">
              <span className="mb-1 block text-xs font-bold">상세 지시</span>
              <textarea
                value={planForm.instruction}
                onChange={(event) => setPlanForm((current) => ({ ...current, instruction: event.target.value }))}
                rows={3}
                className="w-full border border-slate-300 px-3 py-2"
              />
            </label>
            <button disabled={saving} className="bg-slate-950 px-4 py-3 text-sm font-black text-white disabled:opacity-50 sm:col-span-2">
              치료 계획 저장
            </button>
          </form>
        </div>

        <div className="p-4">
          <h3 className="font-black">빠른 수행 기록</h3>
          <form onSubmit={createEvent} className="mt-4 grid gap-3 sm:grid-cols-2">
            <label>
              <span className="mb-1 block text-xs font-bold">기록 종류</span>
              <select
                value={eventForm.eventType}
                onChange={(event) => {
                  const eventType = event.target.value;
                  setEventForm((current) => ({ ...current, eventType, title: eventTitle(eventType) }));
                }}
                className="w-full border border-slate-300 px-3 py-2"
              >
                <option value="medication">투약</option>
                <option value="injection">주사</option>
                <option value="iv">수액</option>
                <option value="meal">식사</option>
                <option value="water">음수</option>
                <option value="urination">배뇨</option>
                <option value="defecation">배변</option>
                <option value="procedure">처치</option>
              </select>
            </label>
            <label>
              <span className="mb-1 block text-xs font-bold">수행 시각</span>
              <input
                type="datetime-local"
                value={eventForm.occurredAt}
                onChange={(event) => setEventForm((current) => ({ ...current, occurredAt: event.target.value }))}
                className="w-full border border-slate-300 px-3 py-2"
              />
            </label>
            <label className="sm:col-span-2">
              <span className="mb-1 block text-xs font-bold">제목</span>
              <input
                required
                value={eventForm.title}
                onChange={(event) => setEventForm((current) => ({ ...current, title: event.target.value }))}
                className="w-full border border-slate-300 px-3 py-2"
              />
            </label>
            <label>
              <span className="mb-1 block text-xs font-bold">수량</span>
              <input
                type="number"
                step="0.01"
                value={eventForm.amountValue}
                onChange={(event) => setEventForm((current) => ({ ...current, amountValue: event.target.value }))}
                className="w-full border border-slate-300 px-3 py-2"
              />
            </label>
            <label>
              <span className="mb-1 block text-xs font-bold">단위</span>
              <input
                value={eventForm.amountUnit}
                onChange={(event) => setEventForm((current) => ({ ...current, amountUnit: event.target.value }))}
                placeholder="mg, mL, g, 회"
                className="w-full border border-slate-300 px-3 py-2"
              />
            </label>
            <label className="sm:col-span-2">
              <span className="mb-1 block text-xs font-bold">수행 내용·담당자 메모</span>
              <textarea
                value={eventForm.content}
                onChange={(event) => setEventForm((current) => ({ ...current, content: event.target.value }))}
                rows={3}
                placeholder="약품명, 투여 경로, 식사 반응, 배변 상태, 담당자 등을 기록"
                className="w-full border border-slate-300 px-3 py-2"
              />
            </label>
            <div className="flex flex-wrap gap-4 text-sm font-bold sm:col-span-2">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={eventForm.abnormalFlag}
                  onChange={(event) => setEventForm((current) => ({ ...current, abnormalFlag: event.target.checked }))}
                />
                이상 소견
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={eventForm.requiresFollowUp}
                  onChange={(event) => setEventForm((current) => ({ ...current, requiresFollowUp: event.target.checked }))}
                />
                재확인 필요
              </label>
            </div>
            <button disabled={saving} className="bg-slate-950 px-4 py-3 text-sm font-black text-white disabled:opacity-50 sm:col-span-2">
              수행 기록 저장
            </button>
          </form>
        </div>
      </div>

      <div className="border-t border-slate-300 p-4">
        <h3 className="font-black">등록된 치료 계획</h3>
        {loading ? (
          <p className="py-8 text-center text-sm text-slate-500">불러오는 중...</p>
        ) : plans.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-500">등록된 치료 계획이 없습니다.</p>
        ) : (
          <div className="mt-3 grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
            {plans.map((plan) => {
              const times = Array.isArray(plan.scheduled_times)
                ? plan.scheduled_times.map(String)
                : [];
              return (
                <article key={plan.id} className="border border-slate-300 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap gap-2 text-[11px] font-black">
                        <span className="bg-slate-200 px-2 py-1">{typeLabel(plan.plan_type)}</span>
                        <span className="bg-blue-100 px-2 py-1 text-blue-800">{statusLabel(plan.status)}</span>
                      </div>
                      <h4 className="mt-2 font-black">{plan.title}</h4>
                    </div>
                    <button type="button" onClick={() => void deletePlan(plan.id)} className="text-xs font-bold text-red-700">
                      삭제
                    </button>
                  </div>
                  {plan.instruction && <p className="mt-3 whitespace-pre-wrap text-sm leading-6">{plan.instruction}</p>}
                  <dl className="mt-3 grid grid-cols-[85px_1fr] gap-y-1 text-xs">
                    <dt className="font-bold text-slate-500">반복</dt><dd>{plan.frequency || "-"}</dd>
                    <dt className="font-bold text-slate-500">예정 시간</dt><dd>{times.length ? times.join(", ") : "-"}</dd>
                    <dt className="font-bold text-slate-500">시작</dt><dd>{new Date(plan.start_at).toLocaleString("ko-KR")}</dd>
                  </dl>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {plan.status !== "active" && plan.status !== "completed" && (
                      <button type="button" disabled={saving} onClick={() => void changeStatus(plan.id, "active")} className="border border-slate-300 px-3 py-2 text-xs font-black">진행</button>
                    )}
                    {plan.status === "active" && (
                      <button type="button" disabled={saving} onClick={() => void changeStatus(plan.id, "paused")} className="border border-slate-300 px-3 py-2 text-xs font-black">일시중지</button>
                    )}
                    {plan.status !== "completed" && (
                      <button type="button" disabled={saving} onClick={() => void changeStatus(plan.id, "completed")} className="bg-slate-950 px-3 py-2 text-xs font-black text-white">완료</button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
