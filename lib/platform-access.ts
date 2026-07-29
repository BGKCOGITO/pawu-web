import { supabaseAdmin } from "./supabase-admin";

export function readBearer(request: Request) {
  const value = request.headers.get("authorization") ?? "";
  return value.startsWith("Bearer ") ? value.slice(7) : "";
}

export async function getUserFromRequest(request: Request) {
  const token = readBearer(request);
  if (!token) return null;
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}

export async function getHospitalMembership(userId: string) {
  const { data: staff } = await supabaseAdmin
    .from("hospital_staff")
    .select("hospital_id, role, permissions")
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle();

  if (staff) {
    return {
      hospitalId: Number(staff.hospital_id),
      role: String(staff.role),
      permissions: (staff.permissions ?? {}) as Record<string, boolean>,
    };
  }

  const { data: admin } = await supabaseAdmin
    .from("hospital_admins")
    .select("hospital_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (!admin) return null;

  return {
    hospitalId: Number(admin.hospital_id),
    role: "owner",
    permissions: {
      manage_staff: true,
      manage_reservations: true,
      write_medical_records: true,
      view_medical_records: true,
      manage_billing_status: true,
      manage_attachments: true,
      view_analytics: true,
    },
  };
}

export async function isMasterAdmin(userId: string) {
  const { data } = await supabaseAdmin
    .from("master_admins")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();

  return Boolean(data);
}
