import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabase-admin";
import { getUserFromRequest } from "../../../../lib/platform-access";

export async function POST(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ ok: false, message: "로그인이 필요합니다." }, { status: 401 });

  const body = (await request.json()) as { token?: string; deviceName?: string };
  const token = String(body.token ?? "").trim();
  if (!token) return NextResponse.json({ ok: false, message: "FCM 토큰이 없습니다." }, { status: 400 });

  const { error } = await supabaseAdmin.from("fcm_tokens").upsert(
    {
      user_id: user.id,
      token,
      device_name: String(body.deviceName ?? "휴대폰").slice(0, 120),
      is_active: true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "token" },
  );

  if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

export async function GET(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ ok: false, message: "로그인이 필요합니다." }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from("fcm_tokens")
    .select("id, is_active, updated_at")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .order("updated_at", { ascending: false })
    .limit(1);

  if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, registered: Boolean(data?.length), updatedAt: data?.[0]?.updated_at ?? null });
}

export async function DELETE(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ ok: false, message: "로그인이 필요합니다." }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as { token?: string };
  let query = supabaseAdmin.from("fcm_tokens").update({ is_active: false, updated_at: new Date().toISOString() }).eq("user_id", user.id);
  if (body.token) query = query.eq("token", body.token);
  const { error } = await query;
  if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
