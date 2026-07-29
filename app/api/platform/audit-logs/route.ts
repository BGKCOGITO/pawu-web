import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabase-admin";
import {
  getHospitalMembership,
  getUserFromRequest,
  isMasterAdmin,
} from "../../../../lib/platform-access";

export async function GET(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ ok: false, message: "로그인이 필요합니다." }, { status: 401 });
  }

  const url = new URL(request.url);
  const scope = url.searchParams.get("scope") ?? "hospital";
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 100), 1), 300);

  if (scope === "admin") {
    if (!(await isMasterAdmin(user.id))) {
      return NextResponse.json({ ok: false, message: "관리자 권한이 없습니다." }, { status: 403 });
    }

    const { data, error } = await supabaseAdmin
      .from("audit_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, logs: data ?? [] });
  }

  const membership = await getHospitalMembership(user.id);
  if (!membership) {
    return NextResponse.json({ ok: false, message: "병원 계정이 아닙니다." }, { status: 403 });
  }

  const { data, error } = await supabaseAdmin
    .from("audit_logs")
    .select("*")
    .eq("hospital_id", membership.hospitalId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, logs: data ?? [] });
}
