import { NextResponse } from "next/server";
import { getHospitalAccess, readBearer } from "../../../../lib/hospital-access";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const accessToken = readBearer(request);
  if (!accessToken) {
    return NextResponse.json(
      { ok: false, message: "로그인이 필요합니다." },
      { status: 401 },
    );
  }

  const access = await getHospitalAccess(accessToken);
  if (!access) {
    return NextResponse.json(
      { ok: false, message: "사용 가능한 병원 계정이 없습니다." },
      { status: 403 },
    );
  }

  const { data: featureRow } = await (await import("../../../../lib/supabase-admin")).supabaseAdmin
    .from("hospital_module_settings")
    .select("inpatient_enabled,surgery_enabled,inventory_enabled,dispensing_enabled,billing_enabled,lab_enabled,guardian_chat_enabled")
    .eq("hospital_id", access.hospitalId)
    .maybeSingle();

  const features = {
    inpatient_enabled: true,
    surgery_enabled: true,
    inventory_enabled: true,
    dispensing_enabled: true,
    billing_enabled: true,
    lab_enabled: true,
    guardian_chat_enabled: true,
    ...(featureRow ?? {}),
  };

  return NextResponse.json({
    ok: true,
    access: {
      userId: access.userId,
      hospitalId: access.hospitalId,
      role: access.role,
      permissions: access.permissions,
      features,
    },
  });
}
