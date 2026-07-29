import { supabaseAdmin } from "./supabase-admin";
import { getAuthUser, getHospitalAccess } from "./v5-access";

export async function requireInventoryAccess(
  request: Request,
  permission: "view_inventory" | "manage_inventory" | "adjust_inventory",
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
    access.permissions[permission] === true ||
    (permission === "view_inventory" &&
      (access.permissions.manage_inventory === true ||
        access.permissions.adjust_inventory === true));

  if (!allowed) {
    return { ok: false as const, status: 403, message: "재고 관리 권한이 없습니다." };
  }

  return {
    ok: true as const,
    user,
    access,
    supabaseAdmin,
  };
}
