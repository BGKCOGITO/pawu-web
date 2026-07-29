import { supabaseAdmin } from "./supabase-admin";

type AuditInput = {
  actorUserId?: string | null;
  actorType: "guardian" | "hospital" | "admin" | "system";
  hospitalId?: number | null;
  action: string;
  entityType: string;
  entityId?: string | number | null;
  details?: Record<string, unknown>;
  ipAddress?: string | null;
  userAgent?: string | null;
};

export async function writeAuditLog(input: AuditInput) {
  const { error } = await supabaseAdmin.from("audit_logs").insert({
    actor_user_id: input.actorUserId ?? null,
    actor_type: input.actorType,
    hospital_id: input.hospitalId ?? null,
    action: input.action,
    entity_type: input.entityType,
    entity_id: input.entityId == null ? null : String(input.entityId),
    details: input.details ?? {},
    ip_address: input.ipAddress ?? null,
    user_agent: input.userAgent ?? null,
  });

  if (error) {
    console.error("PAWU audit log error:", error.message);
  }
}
