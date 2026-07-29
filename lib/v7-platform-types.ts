export type PlatformRole = "owner" | "veterinarian" | "nurse" | "receptionist" | "inventory_manager" | "viewer";

export type PlatformPermission =
  | "view_dashboard" | "view_patients" | "write_medical_records" | "manage_prescriptions"
  | "manage_dispensing" | "manage_billing" | "manage_inventory" | "manage_inpatient"
  | "manage_surgery" | "manage_staff" | "view_audit_logs" | "export_data" | "manage_security";

export type AuditEntry = {
  id: number; action: string; resource_type: string; resource_id: string | null;
  actor_user_id: string | null; actor_role: string | null; severity: string;
  summary: string; metadata: Record<string, unknown>; created_at: string;
};

export type PlatformDashboard = {
  counts: Record<string, number>;
  finance: { todayPaid: number; todayOutstanding: number; monthPaid: number };
  alerts: { critical: number; warning: number; unreadAudit: number };
  recentAudit: AuditEntry[];
};
