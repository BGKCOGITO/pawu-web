import { supabaseAdmin } from "./supabase-admin";
import { getHospitalAccess, readBearer, can, type HospitalAccess } from "./hospital-access";

export async function requirePlatformAccess(request: Request, permission: string) {
  const token = readBearer(request);
  if (!token) return { ok: false as const, status: 401, message: "로그인이 필요합니다." };
  const access = await getHospitalAccess(token);
  if (!access) return { ok: false as const, status: 403, message: "병원 접근 권한이 없습니다." };
  if (!can(access, permission)) return { ok: false as const, status: 403, message: "해당 작업 권한이 없습니다." };
  return { ok: true as const, access, supabaseAdmin };
}

export async function writeAudit(access: HospitalAccess, input: {
  action: string; resourceType: string; resourceId?: string | number | null;
  summary: string; severity?: "info" | "warning" | "critical"; metadata?: Record<string, unknown>;
}) {
  await supabaseAdmin.from("hospital_audit_logs_v7").insert({
    hospital_id: access.hospitalId, actor_user_id: access.userId, actor_role: access.role,
    action: input.action, resource_type: input.resourceType,
    resource_id: input.resourceId == null ? null : String(input.resourceId),
    summary: input.summary, severity: input.severity ?? "info", metadata: input.metadata ?? {},
  });
}
