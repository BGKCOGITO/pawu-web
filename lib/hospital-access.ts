import { supabaseAdmin } from "./supabase-admin";

export type HospitalRole = "owner" | "veterinarian" | "nurse" | "receptionist" | "inventory_manager" | "viewer";

export type HospitalAccess = {
  userId: string;
  hospitalId: number;
  role: HospitalRole;
  permissions: Record<string, boolean>;
};

export async function getHospitalAccess(accessToken: string): Promise<HospitalAccess | null> {
  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(accessToken);
  if (authError || !authData.user) return null;

  const { data: staff } = await supabaseAdmin
    .from("hospital_staff")
    .select("hospital_id, role, permissions, is_active")
    .eq("user_id", authData.user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (staff) {
    return {
      userId: authData.user.id,
      hospitalId: Number(staff.hospital_id),
      role: staff.role as HospitalRole,
      permissions: (staff.permissions ?? {}) as Record<string, boolean>,
    };
  }

  const { data: admin } = await supabaseAdmin
    .from("hospital_admins")
    .select("hospital_id")
    .eq("user_id", authData.user.id)
    .maybeSingle();

  if (!admin) return null;

  return {
    userId: authData.user.id,
    hospitalId: Number(admin.hospital_id),
    role: "owner",
    permissions: {
      manage_staff: true,
      manage_reservations: true,
      write_medical_records: true,
      view_medical_records: true,
      manage_billing_status: true,
      manage_attachments: true,
      view_dashboard: true,
      view_patients: true,
      manage_prescriptions: true,
      manage_dispensing: true,
      manage_billing: true,
      manage_inventory: true,
      manage_inpatient: true,
      manage_surgery: true,
      view_audit_logs: true,
      export_data: true,
      manage_security: true,
    },
  };
}

export function readBearer(request: Request) {
  const value = request.headers.get("authorization") ?? "";
  return value.startsWith("Bearer ") ? value.slice(7) : "";
}

export function can(access: HospitalAccess, permission: string) {
  return access.role === "owner" || access.permissions[permission] === true;
}
