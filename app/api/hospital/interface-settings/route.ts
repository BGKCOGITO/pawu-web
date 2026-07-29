import { NextResponse } from "next/server";
import { getAuthUser, getHospitalAccess } from "../../../../lib/v5-access";
import { supabaseAdmin } from "../../../../lib/supabase-admin";
import {
  HOSPITAL_FEATURES,
  HOSPITAL_WIDGETS,
} from "../../../../lib/hospital-interface-config";

function canManage(role: string) {
  return ["owner", "admin", "manager"].includes(role);
}

async function ensureDefaults(hospitalId: number) {
  await supabaseAdmin.from("hospital_feature_settings").upsert(
    HOSPITAL_FEATURES.map((feature, index) => ({
      hospital_id: hospitalId,
      feature_key: feature.key,
      is_enabled: feature.defaultEnabled,
      sort_order: (index + 1) * 10,
    })),
    { onConflict: "hospital_id,feature_key", ignoreDuplicates: true },
  );

  await supabaseAdmin.from("hospital_dashboard_widgets").upsert(
    HOSPITAL_WIDGETS.map((widget) => ({
      hospital_id: hospitalId,
      widget_key: widget.key,
      is_visible: widget.defaultVisible,
      sort_order: widget.defaultOrder,
      widget_size: widget.size,
    })),
    { onConflict: "hospital_id,widget_key", ignoreDuplicates: true },
  );
}

export async function GET(request: Request) {
  const user = await getAuthUser(request);

  if (!user) {
    return NextResponse.json(
      { ok: false, message: "로그인이 필요합니다." },
      { status: 401 },
    );
  }

  const access = await getHospitalAccess(user.id);

  if (!access) {
    return NextResponse.json(
      { ok: false, message: "병원 계정이 아닙니다." },
      { status: 403 },
    );
  }

  await ensureDefaults(access.hospitalId);

  const [{ data: features, error: featureError }, { data: widgets, error: widgetError }] =
    await Promise.all([
      supabaseAdmin
        .from("hospital_feature_settings")
        .select("feature_key, is_enabled, sort_order")
        .eq("hospital_id", access.hospitalId)
        .order("sort_order"),
      supabaseAdmin
        .from("hospital_dashboard_widgets")
        .select("widget_key, is_visible, sort_order, widget_size")
        .eq("hospital_id", access.hospitalId)
        .order("sort_order"),
    ]);

  if (featureError || widgetError) {
    return NextResponse.json(
      {
        ok: false,
        message: featureError?.message ?? widgetError?.message ?? "설정을 불러오지 못했습니다.",
      },
      { status: 400 },
    );
  }

  return NextResponse.json({
    ok: true,
    canManage: canManage(access.role),
    role: access.role,
    features: features ?? [],
    widgets: widgets ?? [],
  });
}

export async function PUT(request: Request) {
  const user = await getAuthUser(request);

  if (!user) {
    return NextResponse.json(
      { ok: false, message: "로그인이 필요합니다." },
      { status: 401 },
    );
  }

  const access = await getHospitalAccess(user.id);

  if (!access) {
    return NextResponse.json(
      { ok: false, message: "병원 계정이 아닙니다." },
      { status: 403 },
    );
  }

  if (!canManage(access.role)) {
    return NextResponse.json(
      { ok: false, message: "원장 또는 관리자만 병원 공통 화면을 변경할 수 있습니다." },
      { status: 403 },
    );
  }

  const body = await request.json();
  const type = String(body.type ?? "");

  if (type === "features") {
    const items = Array.isArray(body.items) ? body.items : [];
    const allowed = new Set(HOSPITAL_FEATURES.map((item) => item.key));

    const rows = items
      .filter((item: any) => allowed.has(String(item.key)))
      .map((item: any, index: number) => ({
        hospital_id: access.hospitalId,
        feature_key: String(item.key),
        is_enabled: item.isEnabled === true,
        sort_order: (index + 1) * 10,
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      }));

    const dashboard = rows.find((row: any) => row.feature_key === "dashboard");
    if (dashboard) dashboard.is_enabled = true;

    const { error } = await supabaseAdmin
      .from("hospital_feature_settings")
      .upsert(rows, { onConflict: "hospital_id,feature_key" });

    if (error) {
      return NextResponse.json({ ok: false, message: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  }

  if (type === "widgets") {
    const items = Array.isArray(body.items) ? body.items : [];
    const definitions = new Map(HOSPITAL_WIDGETS.map((item) => [item.key, item]));

    const rows = items
      .filter((item: any) => definitions.has(String(item.key)))
      .map((item: any, index: number) => {
        const definition = definitions.get(String(item.key))!;
        return {
          hospital_id: access.hospitalId,
          widget_key: String(item.key),
          is_visible: item.isVisible === true,
          sort_order: (index + 1) * 10,
          widget_size: ["small", "medium", "large"].includes(String(item.size))
            ? String(item.size)
            : definition.size,
          updated_by: user.id,
          updated_at: new Date().toISOString(),
        };
      });

    const { error } = await supabaseAdmin
      .from("hospital_dashboard_widgets")
      .upsert(rows, { onConflict: "hospital_id,widget_key" });

    if (error) {
      return NextResponse.json({ ok: false, message: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  }

  if (type === "reset") {
    const { error: featureDeleteError } = await supabaseAdmin
      .from("hospital_feature_settings")
      .delete()
      .eq("hospital_id", access.hospitalId);

    if (featureDeleteError) {
      return NextResponse.json(
        { ok: false, message: featureDeleteError.message },
        { status: 400 },
      );
    }

    const { error: widgetDeleteError } = await supabaseAdmin
      .from("hospital_dashboard_widgets")
      .delete()
      .eq("hospital_id", access.hospitalId);

    if (widgetDeleteError) {
      return NextResponse.json(
        { ok: false, message: widgetDeleteError.message },
        { status: 400 },
      );
    }

    await ensureDefaults(access.hospitalId);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json(
    { ok: false, message: "설정 유형이 올바르지 않습니다." },
    { status: 400 },
  );
}
