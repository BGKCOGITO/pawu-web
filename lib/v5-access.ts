import { supabaseAdmin } from "./supabase-admin";

export function readBearer(request: Request) {
  const value = request.headers.get("authorization") ?? "";
  return value.startsWith("Bearer ") ? value.slice(7) : "";
}

export async function getAuthUser(request: Request) {
  const token = readBearer(request);
  if (!token) return null;

  const { data, error } = await supabaseAdmin.auth.getUser(token);

  if (error || !data.user) {
    return null;
  }

  return data.user;
}

export async function getHospitalAccess(userId: string) {
  const { data: staff, error: staffError } = await supabaseAdmin
    .from("hospital_staff")
    .select("hospital_id, role, permissions")
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle();

  if (!staffError && staff) {
    return {
      hospitalId: Number(staff.hospital_id),
      role: String(staff.role ?? "staff"),
      permissions: (staff.permissions ?? {}) as Record<string, boolean>,
    };
  }

  const { data: admin, error: adminError } = await supabaseAdmin
    .from("hospital_admins")
    .select("hospital_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (adminError || !admin) {
    return null;
  }

  return {
    hospitalId: Number(admin.hospital_id),
    role: "owner",
    permissions: {
      manage_billing_catalog: true,
      create_invoices: true,
      manage_payments: true,
      view_inventory: true,
      manage_inventory: true,
      adjust_inventory: true,
    } as Record<string, boolean>,
  };
}

export function hasPermission(
  access: Awaited<ReturnType<typeof getHospitalAccess>>,
  permission: string,
) {
  return Boolean(
    access &&
      (access.role === "owner" || access.permissions[permission] === true),
  );
}
