import { NextResponse } from "next/server";
import { collectSystemMonitorSnapshot } from "@/lib/ops/system-monitor";

export const dynamic = "force-dynamic";

export async function GET() {
  const snapshot = await collectSystemMonitorSnapshot();
  const databaseChecks = snapshot.checks.filter((item) => !["environment", "openai"].includes(item.key));
  const environment = snapshot.checks.find((item) => item.key === "environment");
  const openai = snapshot.checks.find((item) => item.key === "openai");
  const database = databaseChecks.some((item) => item.status === "error") ? "error" : "ok";

  return NextResponse.json(
    {
      status: snapshot.status === "error" ? "degraded" : "ok",
      version: "1.0.0-rc2",
      checks: {
        environment: environment?.status === "error" ? "error" : "ok",
        database,
        openai: openai?.status === "ok" ? "configured" : "fallback-template",
      },
      responseTimeMs: snapshot.responseTimeMs,
      timestamp: snapshot.checkedAt,
    },
    {
      status: snapshot.status === "error" ? 503 : 200,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
