import { getAuthUser, getHospitalAccess } from "./v5-access";
import { supabaseAdmin } from "./supabase-admin";

export async function requirePrescriptionAccess(
  request: Request,
  permission: "view_prescription" | "write_prescription" | "finalize_prescription",
) {
  const user = await getAuthUser(request);

  if (!user) {
    return { ok: false as const, status: 401, message: "로그인이 필요합니다." };
  }

  const access = await getHospitalAccess(user.id);

  if (!access) {
    return { ok: false as const, status: 403, message: "병원 계정이 아닙니다." };
  }

  const allowed =
    access.role === "owner" ||
    access.role === "veterinarian" ||
    access.permissions[permission] === true ||
    (permission === "view_prescription" &&
      (access.permissions.write_prescription === true ||
        access.permissions.finalize_prescription === true));

  if (!allowed) {
    return { ok: false as const, status: 403, message: "처방 관리 권한이 없습니다." };
  }

  return { ok: true as const, user, access, supabaseAdmin };
}
