import { supabaseAdmin } from "@/lib/supabase-admin";
import { checkServerEnvironment } from "@/lib/server/env";
import { getOpenAiMedicalConfig } from "@/lib/ai/openai-config";

export type MonitorStatus = "ok" | "warning" | "error";

export type SystemCheck = {
  key: string;
  label: string;
  status: MonitorStatus;
  latencyMs: number;
  detail: string;
};

export type SystemMonitorSnapshot = {
  version: string;
  status: MonitorStatus;
  checkedAt: string;
  responseTimeMs: number;
  process: {
    uptimeSeconds: number;
    rssMb: number;
    heapUsedMb: number;
    heapTotalMb: number;
    nodeVersion: string;
  };
  checks: SystemCheck[];
};

async function timedCheck(
  key: string,
  label: string,
  run: () => Promise<string>,
): Promise<SystemCheck> {
  const startedAt = Date.now();
  try {
    const detail = await run();
    const latencyMs = Date.now() - startedAt;
    return {
      key,
      label,
      status: latencyMs >= 1500 ? "warning" : "ok",
      latencyMs,
      detail,
    };
  } catch (error) {
    return {
      key,
      label,
      status: "error",
      latencyMs: Date.now() - startedAt,
      detail: error instanceof Error ? error.message : "알 수 없는 오류",
    };
  }
}

async function tableCheck(table: string, label: string): Promise<SystemCheck> {
  return timedCheck(table, label, async () => {
    const { error, count } = await supabaseAdmin
      .from(table)
      .select("id", { head: true, count: "exact" })
      .limit(1);
    if (error) throw new Error(error.message);
    return `정상 응답 · ${Number(count ?? 0).toLocaleString("ko-KR")}건`;
  });
}

export async function collectSystemMonitorSnapshot(): Promise<SystemMonitorSnapshot> {
  const startedAt = Date.now();
  const environment = checkServerEnvironment();
  const openai = getOpenAiMedicalConfig();

  const environmentCheck: SystemCheck = {
    key: "environment",
    label: "서버 환경변수",
    status: environment.ok ? (environment.warnings.length ? "warning" : "ok") : "error",
    latencyMs: 0,
    detail: environment.ok
      ? environment.warnings.length
        ? environment.warnings.join(" / ")
        : "필수 환경변수 정상"
      : `누락: ${environment.missing.join(", ")}`,
  };

  const openaiCheck: SystemCheck = {
    key: "openai",
    label: "OpenAI 의료보조",
    status: openai.enabled ? "ok" : "warning",
    latencyMs: 0,
    detail: openai.enabled ? `연결 설정됨 · ${openai.model}` : "템플릿 대체 모드",
  };

  const checks = await Promise.all([
    tableCheck("hospitals", "병원 데이터베이스"),
    tableCheck("reservations", "예약 데이터"),
    tableCheck("medical_records", "전자차트 데이터"),
    tableCheck("hospitalizations", "입원 데이터"),
    tableCheck("audit_logs", "감사 로그"),
  ]);

  const allChecks = [environmentCheck, openaiCheck, ...checks];
  const status: MonitorStatus = allChecks.some((item) => item.status === "error")
    ? "error"
    : allChecks.some((item) => item.status === "warning")
      ? "warning"
      : "ok";

  const memory = process.memoryUsage();
  return {
    version: "9.5.0",
    status,
    checkedAt: new Date().toISOString(),
    responseTimeMs: Date.now() - startedAt,
    process: {
      uptimeSeconds: Math.round(process.uptime()),
      rssMb: Math.round(memory.rss / 1024 / 1024),
      heapUsedMb: Math.round(memory.heapUsed / 1024 / 1024),
      heapTotalMb: Math.round(memory.heapTotal / 1024 / 1024),
      nodeVersion: process.version,
    },
    checks: allChecks,
  };
}

export async function saveSystemMonitorSnapshot(snapshot: SystemMonitorSnapshot) {
  const { error } = await supabaseAdmin.from("system_health_snapshots").insert({
    overall_status: snapshot.status,
    app_version: snapshot.version,
    response_time_ms: snapshot.responseTimeMs,
    process_memory_mb: snapshot.process.rssMb,
    process_uptime_seconds: snapshot.process.uptimeSeconds,
    checks: snapshot.checks,
    checked_at: snapshot.checkedAt,
  });
  if (error) throw new Error(error.message);
}
