import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/server/rate-limit";
import { getRequestMeta } from "@/lib/server/request-meta";

export type SecurityRatePolicy = {
  scope: string;
  limit: number;
  windowMs: number;
  identity?: string | null;
};

export function enforceRateLimit(
  request: NextRequest,
  policy: SecurityRatePolicy,
): NextResponse | null {
  const meta = getRequestMeta(request);
  const identity = policy.identity || meta.ipAddress || "unknown";
  const result = checkRateLimit(
    `${policy.scope}:${identity}`,
    policy.limit,
    policy.windowMs,
  );

  if (result.allowed) return null;

  const retryAfterSeconds = Math.max(
    1,
    Math.ceil((result.resetAt - Date.now()) / 1000),
  );

  return NextResponse.json(
    {
      success: false,
      error: {
        code: "RATE_LIMITED",
        message: "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.",
      },
      meta: {
        requestId: meta.requestId,
        retryAfterSeconds,
      },
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfterSeconds),
        "X-RateLimit-Limit": String(policy.limit),
        "X-RateLimit-Remaining": "0",
        "X-Request-Id": meta.requestId,
      },
    },
  );
}
