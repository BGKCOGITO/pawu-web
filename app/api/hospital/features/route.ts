import { NextResponse } from "next/server";
import { getHospitalAccess, readBearer } from "../../../../lib/hospital-access";
import { supabaseAdmin } from "../../../../lib/supabase-admin";

export const dynamic = "force-dynamic";

const defaults = {
  inpatient_enabled: true,
  surgery_enabled: true,
  inventory_enabled: true,
  dispensing_enabled: true,
  billing_enabled: true,
  lab_enabled: true,
  guardian_chat_enabled: true,
};

async function resolveAccess(request: Request) {
  const token = readBearer(request);
  if (!token) return null;
  return getHospitalAccess(token);
}

export async function GET(request: Request) {
  const access = await resolveAccess(request);
  if (!access) return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from("hospital_module_settings")
    .select("*")
    .eq("hospital_id", access.hospitalId)
    .maybeSingle();

  if (error) return NextResponse.json({ message: error.message }, { status: 500 });
  return NextResponse.json({ features: { ...defaults, ...(data ?? {}) } });
}

export async function PATCH(request: Request) {
  const access = await resolveAccess(request);
  if (!access) return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  if (access.role !== "owner" && access.permissions.manage_security !== true) {
    return NextResponse.json({ message: "병원 설정 권한이 없습니다." }, { status: 403 });
  }

  const body = (await request.json()) as Partial<typeof defaults>;
  const safe = Object.fromEntries(
    Object.keys(defaults).map((key) => [key, body[key as keyof typeof defaults] === true]),
  );

  const { data, error } = await supabaseAdmin
    .from("hospital_module_settings")
    .upsert({ hospital_id: access.hospitalId, ...safe, updated_by: access.userId, updated_at: new Date().toISOString() })
    .select("*")
    .single();

  if (error) return NextResponse.json({ message: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, features: data });
}
