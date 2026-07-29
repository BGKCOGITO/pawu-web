import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabase-admin";
import { getUserFromRequest } from "../../../lib/platform-access";
import { writeAuditLog } from "../../../lib/audit-log";

export async function GET(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ ok: false, message: "로그인이 필요합니다." }, { status: 401 });
  }

  const url = new URL(request.url);
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 30), 1), 100);

  const { data, error } = await supabaseAdmin
    .from("notifications")
    .select("id, type, title, body, link_url, read_at, created_at, metadata")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, notifications: data ?? [] });
}

export async function PATCH(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ ok: false, message: "로그인이 필요합니다." }, { status: 401 });
  }

  const body = (await request.json()) as {
    notificationId?: number;
    markAll?: boolean;
  };

  const now = new Date().toISOString();

  let query = supabaseAdmin
    .from("notifications")
    .update({ read_at: now })
    .eq("user_id", user.id)
    .is("read_at", null);

  if (!body.markAll) {
    query = query.eq("id", Number(body.notificationId));
  }

  const { error } = await query;
  if (error) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 400 });
  }

  await writeAuditLog({
    actorUserId: user.id,
    actorType: "guardian",
    action: body.markAll ? "notifications.read_all" : "notification.read",
    entityType: "notification",
    entityId: body.notificationId ?? null,
  });

  return NextResponse.json({ ok: true });
}
