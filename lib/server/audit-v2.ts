import type { NextRequest } from "next/server";
import { writeAuditLog } from "@/lib/audit-log";
import { getRequestMeta } from "@/lib/server/request-meta";

type AuditActorType = "guardian" | "hospital" | "admin" | "system";

type AuditV2Input = {
  request?: NextRequest;
  actorUserId?: string | null;
  actorType: AuditActorType;
  hospitalId?: number | null;
  action: string;
  entityType: string;
  entityId?: string | number | null;
  before?: unknown;
  after?: unknown;
  result?: "success" | "failure" | "partial";
  reason?: string | null;
  extra?: Record<string, unknown>;
};

function redact(value: unknown): unknown {
  if (!value || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(redact);

  const secretKeys = new Set([
    "password",
    "token",
    "access_token",
    "refresh_token",
    "authorization",
    "api_key",
    "secret",
  ]);

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, item]) => [
      key,
      secretKeys.has(key.toLowerCase()) ? "[REDACTED]" : redact(item),
    ]),
  );
}

export async function writeAuditLogV2(input: AuditV2Input) {
  const meta = input.request ? getRequestMeta(input.request) : null;

  await writeAuditLog({
    actorUserId: input.actorUserId,
    actorType: input.actorType,
    hospitalId: input.hospitalId,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    details: {
      schemaVersion: 2,
      result: input.result ?? "success",
      reason: input.reason ?? null,
      requestId: meta?.requestId ?? null,
      before: redact(input.before),
      after: redact(input.after),
      ...(input.extra ?? {}),
    },
    ipAddress: meta?.ipAddress ?? null,
    userAgent: meta?.userAgent ?? null,
  });
}
