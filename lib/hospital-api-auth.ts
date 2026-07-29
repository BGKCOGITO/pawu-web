import type { NextRequest } from "next/server";
import type { HospitalPermission } from "@/lib/hospital-permissions";
import { requireHospitalAccess } from "@/lib/server/hospital-guard";

/**
 * V9 공통 병원 API 인증 진입점.
 *
 * 기존 API의 반환 형식을 유지하면서, 선택적으로 권한까지 검사합니다.
 * 기존 호출: requireHospitalContext(request)
 * 권한 호출: requireHospitalContext(request, "write_medical_records")
 */
export async function requireHospitalContext(
  request: NextRequest,
  permission?: HospitalPermission,
) {
  const result = await requireHospitalAccess(request, permission);

  if ("error" in result) {
    return {
      error: result.error,
      code: result.code,
      status: result.status,
    };
  }

  return {
    user: result.user,
    hospitalId: result.hospitalId,
    role: result.role,
    permissions: result.permissions,
    status: 200 as const,
  };
}
