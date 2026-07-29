import { getAuthUser, getHospitalAccess } from "./v5-access";
import { supabaseAdmin } from "./supabase-admin";

export async function requireDispensingAccess(
  request: Request,
  permission: "view" | "dispense",
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
    access.role === "nurse" ||
    access.role === "assistant" ||
    access.permissions.view_dispensing === true ||
    (permission === "dispense" &&
      access.permissions.manage_dispensing === true);

  if (!allowed) {
    return { ok: false as const, status: 403, message: "조제 관리 권한이 없습니다." };
  }

  if (
    permission === "dispense" &&
    !(
      access.role === "owner" ||
      access.role === "veterinarian" ||
      access.role === "nurse" ||
      access.permissions.manage_dispensing === true
    )
  ) {
    return { ok: false as const, status: 403, message: "조제 완료 권한이 없습니다." };
  }

  return { ok: true as const, user, access, supabaseAdmin };
}
