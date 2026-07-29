import { getAuthUser, getHospitalAccess } from "./v5-access";
import { supabaseAdmin } from "./supabase-admin";

export async function requireEmrEditorAccess(
  request: Request,
  permission: "view" | "write" | "finalize" | "reopen",
) {
  const user = await getAuthUser(request);

  if (!user) {
    return { ok: false as const, status: 401, message: "로그인이 필요합니다." };
  }

  const access = await getHospitalAccess(user.id);

  if (!access) {
    return { ok: false as const, status: 403, message: "병원 계정이 아닙니다." };
  }

  const role = String(access.role ?? "");
  const permissions = access.permissions ?? {};

  const canView =
    ["owner", "veterinarian", "nurse", "assistant", "receptionist"].includes(role) ||
    permissions.view_emr === true;

  const canWrite =
    ["owner", "veterinarian", "nurse"].includes(role) ||
    permissions.write_emr === true;

  const canFinalize =
    ["owner", "veterinarian"].includes(role) ||
    permissions.finalize_emr === true;

  const canReopen = role === "owner" || permissions.reopen_emr === true;

  const allowed =
    permission === "view"
      ? canView
      : permission === "write"
        ? canWrite
        : permission === "finalize"
          ? canFinalize
          : canReopen;

  if (!allowed) {
    const message =
      permission === "finalize"
        ? "차트 확정 권한이 없습니다."
        : permission === "reopen"
          ? "확정 차트 재개 권한이 없습니다. 원장 권한이 필요합니다."
          : "전자차트 작성 권한이 없습니다.";
    return { ok: false as const, status: 403, message };
  }

  return { ok: true as const, user, access, supabaseAdmin };
}
