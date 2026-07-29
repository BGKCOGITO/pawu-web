import type { NextRequest } from "next/server";

export function getRequestMeta(request: NextRequest) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  return {
    ipAddress: forwardedFor?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || null,
    userAgent: request.headers.get("user-agent"),
    requestId: request.headers.get("x-request-id") || crypto.randomUUID(),
  };
}
