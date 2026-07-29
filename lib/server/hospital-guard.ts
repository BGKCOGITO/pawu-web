import type { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import type { HospitalPermission } from "@/lib/hospital-permissions";
import { hasHospitalPermission } from "@/lib/hospital-permissions";

export type HospitalApiContext = {
  user: { id: string; email?: string };
  hospitalId: number;
  role: string;
  permissions: Record<string, boolean>;
};

export type HospitalGuardFailure = {
  error: string;
  code: "UNAUTHORIZED" | "FORBIDDEN";
  status: 401 | 403;
};

function bearerToken(request: NextRequest) {
  const authorization = request.headers.get("authorization") ?? "";
  return authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
}

export async function requireHospitalAccess(
  request: NextRequest,
  permission?: HospitalPermission,
): Promise<HospitalApiContext | HospitalGuardFailure> {
  const token = bearerToken(request);
  if (!token) return { error: "로그인이 필요합니다.", code: "UNAUTHORIZED", status: 401 };

  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
  const user = authData.user;
  if (authError || !user) {
    return { error: "로그인 정보가 유효하지 않습니다.", code: "UNAUTHORIZED", status: 401 };
  }

  const { data: staff } = await supabaseAdmin
    .from("hospital_staff")
    .select("hospital_id,role,permissions,is_active")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  let hospitalId = staff?.hospital_id ? Number(staff.hospital_id) : null;
  let role = String(staff?.role || "viewer");
  let permissions = (staff?.permissions && typeof staff.permissions === "object"
    ? staff.permissions
    : {}) as Record<string, boolean>;

  if (!hospitalId) {
    const { data: admin } = await supabaseAdmin
      .from("hospital_admins")
      .select("hospital_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (admin?.hospital_id) {
      hospitalId = Number(admin.hospital_id);
      role = "owner";
      permissions = {};
    }
  }

  if (!hospitalId) {
    return { error: "이 계정에 연결된 병원 정보를 찾을 수 없습니다.", code: "FORBIDDEN", status: 403 };
  }

  const access = {
    userId: user.id,
    hospitalId,
    role: role as any,
    permissions,
    features: {},
  };

  if (permission && !hasHospitalPermission(access, permission)) {
    return { error: "이 작업을 수행할 권한이 없습니다.", code: "FORBIDDEN", status: 403 };
  }

  return {
    user: { id: user.id, email: user.email },
    hospitalId,
    role,
    permissions,
  };
}
