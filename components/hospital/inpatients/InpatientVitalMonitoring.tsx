"use client";

import { useEffect, useMemo, useState } from "react";

type VitalEvent = {
  id: number;
  occurred_at: string;
  temperature_c: number | null;
  heart_rate_bpm: number | null;
  respiratory_rate_bpm: number | null;
  systolic_bp: number | null;
  diastolic_bp: number | null;
  oxygen_saturation_pct: number | null;
  weight_kg: number | null;
  pain_score: number | null;
  abnormal_flag: boolean;
  requires_follow_up: boolean;
};

type Threshold = { min: string; max: string };
type Thresholds = Record<"temperature" | "heart" | "respiration" | "spo2", Threshold>;

const EMPTY_THRESHOLDS: Thresholds = {
  temperature: { min: "", max: "" },
  heart: { min: "", max: "" },
  respiration: { min: "", max: "" },
  spo2: { min: "", max: "" },
};

function formatTime(value: string) {
  return new Date(value).toLocaleString("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function numberOrNull(value: string) {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isOutside(value: number | null, threshold: Threshold) {
  if (value === null) return false;
  const min = numberOrNull(threshold.min);
  const max = numberOrNull(threshold.max);
  return (min !== null && value < min) || (max !== null && value > max);
}

function MetricChart({
  title,
  unit,
  values,
  threshold,
}: {
  title: string;
  unit: string;
  values: Array<{ id: number; time: string; value: number }>;
  threshold: Threshold;
}) {
  const width = 720;
  const height = 210;
  const paddingX = 42;
  const paddingY = 28;

  const stats = useMemo(() => {
    if (!values.length) return null;
    const nums = values.map((item) => item.value);
    const min = Math.min(...nums);
    const max = Math.max(...nums);
    const latest = values[values.length - 1].value;
    const previous = values.length > 1 ? values[values.length - 2].value : null;
    return { min, max, latest, previous };
  }, [values]);

  const points = useMemo(() => {
    if (!values.length) return "";
    const nums = values.map((item) => item.value);
    let min = Math.min(...nums);
    let max = Math.max(...nums);
    if (min === max) {
      min -= 1;
      max += 1;
    }
    return values
      .map((item, index) => {
        const x =
          paddingX +
          (values.length === 1
            ? (width - paddingX * 2) / 2
            : (index / (values.length - 1)) * (width - paddingX * 2));
        const y =
          height -
          paddingY -
          ((item.value - min) / (max - min)) * (height - paddingY * 2);
        return `${x},${y}`;
      })
      .join(" ");
  }, [values]);

  const latestOutside = stats ? isOutside(stats.latest, threshold) : false;

  return (
    <article className="border border-slate-300 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-black">{title}</h3>
          <p className="mt-1 text-xs text-slate-500">직원이 입력한 기록 기준</p>
        </div>
        {stats && (
          <span
            className={`px-3 py-1 text-xs font-black ${
              latestOutside
                ? "bg-orange-100 text-orange-800"
                : "bg-slate-100 text-slate-700"
            }`}
          >
            최신 {stats.latest} {unit}
          </span>
        )}
      </div>

      {!values.length ? (
        <div className="mt-4 flex h-[210px] items-center justify-center border border-dashed border-slate-300 text-sm text-slate-500">
          그래프를 표시할 기록이 없습니다.
        </div>
      ) : (
        <>
          <div className="mt-4 overflow-x-auto border border-slate-200 bg-slate-50">
            <svg viewBox={`0 0 ${width} ${height}`} className="h-[210px] min-w-[560px] w-full" role="img" aria-label={`${title} 변화 그래프`}>
              {[0, 1, 2, 3, 4].map((line) => {
                const y = paddingY + (line / 4) * (height - paddingY * 2);
                return <line key={line} x1={paddingX} y1={y} x2={width - paddingX} y2={y} stroke="currentColor" opacity="0.12" />;
              })}
              <polyline points={points} fill="none" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
              {points.split(" ").map((point, index) => {
                const [cx, cy] = point.split(",");
                return <circle key={values[index].id} cx={cx} cy={cy} r="4" fill="white" stroke="currentColor" strokeWidth="3" />;
              })}
            </svg>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
            <div className="bg-slate-50 p-2"><p className="text-xs font-bold text-slate-500">최저</p><p className="mt-1 font-black">{stats?.min} {unit}</p></div>
            <div className="bg-slate-50 p-2"><p className="text-xs font-bold text-slate-500">최고</p><p className="mt-1 font-black">{stats?.max} {unit}</p></div>
            <div className="bg-slate-50 p-2"><p className="text-xs font-bold text-slate-500">직전 대비</p><p className="mt-1 font-black">{stats?.previous === null ? "-" : `${Number((stats!.latest - stats!.previous!).toFixed(2))} ${unit}`}</p></div>
          </div>
          <p className="mt-3 truncate text-xs text-slate-500">
            {formatTime(values[0].time)} → {formatTime(values[values.length - 1].time)}
          </p>
        </>
      )}
    </article>
  );
}

export default function InpatientVitalMonitoring({
  hospitalizationId,
  events,
}: {
  hospitalizationId: string;
  events: VitalEvent[];
}) {
  const storageKey = `pawu:vital-thresholds:${hospitalizationId}`;
  const [thresholds, setThresholds] = useState<Thresholds>(EMPTY_THRESHOLDS);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(storageKey);
      if (saved) setThresholds({ ...EMPTY_THRESHOLDS, ...JSON.parse(saved) });
    } catch {
      // 브라우저 저장소를 사용할 수 없어도 모니터링은 계속 표시합니다.
    }
  }, [storageKey]);

  function saveThresholds() {
    window.localStorage.setItem(storageKey, JSON.stringify(thresholds));
    setShowSettings(false);
  }

  const chronological = useMemo(
    () => [...events].sort((a, b) => new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime()),
    [events],
  );

  function metricValues(key: keyof VitalEvent) {
    return chronological
      .filter((item) => typeof item[key] === "number")
      .slice(-24)
      .map((item) => ({ id: item.id, time: item.occurred_at, value: Number(item[key]) }));
  }

  const latest = chronological[chronological.length - 1] ?? null;
  type ThresholdAlert = [label: string, value: number | null, unit: string, threshold: Threshold];
  const thresholdAlerts: ThresholdAlert[] = latest
    ? ([
        ["체온", latest.temperature_c, "℃", thresholds.temperature],
        ["심박수", latest.heart_rate_bpm, "bpm", thresholds.heart],
        ["호흡수", latest.respiratory_rate_bpm, "/min", thresholds.respiration],
        ["SpO₂", latest.oxygen_saturation_pct, "%", thresholds.spo2],
      ] satisfies ThresholdAlert[]).filter(([, value, , threshold]) => isOutside(value, threshold))
    : [];

  const staffAlerts = events.filter((item) => item.abnormal_flag || item.requires_follow_up).slice(0, 5);

  return (
    <section className="mt-5 border border-slate-300 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-300 px-4 py-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Manual Vital Monitoring</p>
          <h2 className="mt-1 text-xl font-black">입원 활력징후 모니터링</h2>
          <p className="mt-1 text-xs text-slate-500">의료진이 직접 입력한 최근 24개 기록으로 그래프를 생성합니다.</p>
        </div>
        <button type="button" onClick={() => setShowSettings((value) => !value)} className="border border-slate-950 px-4 py-2 text-sm font-black">
          참고 기준 설정
        </button>
      </div>

      {showSettings && (
        <div className="border-b border-slate-300 bg-slate-50 p-4">
          <div className="mb-4 border-l-4 border-orange-400 bg-orange-50 px-3 py-2 text-sm leading-6">
            병원에서 환자별 참고 범위를 직접 입력하세요. 이 알림은 진단이나 응급 판정이 아니며 의료진 확인을 보조합니다.
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {([
              ["temperature", "체온 (℃)"],
              ["heart", "심박수 (bpm)"],
              ["respiration", "호흡수 (/min)"],
              ["spo2", "SpO₂ (%)"],
            ] as const).map(([key, label]) => (
              <div key={key} className="border border-slate-300 bg-white p-3">
                <p className="text-sm font-black">{label}</p>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <input type="number" step="0.1" placeholder="최소" value={thresholds[key].min} onChange={(event) => setThresholds((current) => ({ ...current, [key]: { ...current[key], min: event.target.value } }))} className="w-full border border-slate-300 px-2 py-2 text-sm" />
                  <input type="number" step="0.1" placeholder="최대" value={thresholds[key].max} onChange={(event) => setThresholds((current) => ({ ...current, [key]: { ...current[key], max: event.target.value } }))} className="w-full border border-slate-300 px-2 py-2 text-sm" />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <button type="button" onClick={() => setThresholds(EMPTY_THRESHOLDS)} className="border border-slate-300 px-4 py-2 text-sm font-bold">초기화</button>
            <button type="button" onClick={saveThresholds} className="bg-slate-950 px-4 py-2 text-sm font-black text-white">기준 저장</button>
          </div>
        </div>
      )}

      <div className="grid gap-4 p-4 xl:grid-cols-[1fr_320px]">
        <div className="grid gap-4 lg:grid-cols-2">
          <MetricChart title="체온 변화" unit="℃" values={metricValues("temperature_c")} threshold={thresholds.temperature} />
          <MetricChart title="심박수 변화" unit="bpm" values={metricValues("heart_rate_bpm")} threshold={thresholds.heart} />
          <MetricChart title="호흡수 변화" unit="/min" values={metricValues("respiratory_rate_bpm")} threshold={thresholds.respiration} />
          <MetricChart title="SpO₂ 변화" unit="%" values={metricValues("oxygen_saturation_pct")} threshold={thresholds.spo2} />
        </div>

        <aside className="space-y-4">
          <div className="border border-slate-300 p-4">
            <h3 className="font-black">참고 알림</h3>
            {thresholdAlerts.length === 0 ? (
              <p className="mt-3 text-sm leading-6 text-slate-500">최신 측정값에서 설정한 참고 범위 이탈이 없습니다.</p>
            ) : (
              <div className="mt-3 space-y-2">
                {thresholdAlerts.map(([label, value, unit]) => (
                  <div key={String(label)} className="border-l-4 border-orange-500 bg-orange-50 px-3 py-2 text-sm">
                    <p className="font-black">{label} 확인 필요</p>
                    <p className="mt-1">최신값 {String(value)} {unit}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="border border-slate-300 p-4">
            <h3 className="font-black">의료진 표시 기록</h3>
            {staffAlerts.length === 0 ? (
              <p className="mt-3 text-sm leading-6 text-slate-500">이상 소견 또는 재확인으로 표시된 활력징후가 없습니다.</p>
            ) : (
              <div className="mt-3 space-y-2">
                {staffAlerts.map((item) => (
                  <div key={item.id} className="bg-red-50 px-3 py-2 text-sm">
                    <p className="font-black text-red-800">{item.abnormal_flag ? "이상 소견" : "재확인 필요"}</p>
                    <p className="mt-1 text-xs text-slate-600">{formatTime(item.occurred_at)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="border border-slate-300 bg-slate-50 p-4 text-xs leading-6 text-slate-600">
            본 화면은 기계와 실시간으로 연결된 모니터가 아닙니다. 직원이 입력한 측정값을 시각화하며 모든 판단과 조치는 의료진이 수행합니다.
          </div>
        </aside>
      </div>
    </section>
  );
}
