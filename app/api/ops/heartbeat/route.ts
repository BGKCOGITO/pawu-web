import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { collectSystemMonitorSnapshot, saveSystemMonitorSnapshot } from "@/lib/ops/system-monitor";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const configuredSecret = process.env.PAWU_CRON_SECRET?.trim();
  const suppliedSecret = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();

  if (!configuredSecret || suppliedSecret !== configuredSecret) {
    return NextResponse.json({ success: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const snapshot = await collectSystemMonitorSnapshot();
  try {
    await saveSystemMonitorSnapshot(snapshot);
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        data: snapshot,
        error: error instanceof Error ? error.message : "스냅샷 저장 실패",
      },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true, data: snapshot }, { headers: { "Cache-Control": "no-store" } });
}
