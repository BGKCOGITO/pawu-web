import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabase-admin";
import { getUserFromRequest } from "../../../../lib/platform-access";

export async function GET(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ ok: false, message: "로그인이 필요합니다." }, { status: 401 });
  }

  const { data } = await supabaseAdmin
    .from("notification_preferences")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  return NextResponse.json({
    ok: true,
    preferences:
      data ?? {
        reservation_updates: true,
        chat_messages: true,
        medical_updates: true,
        medication_reminders: true,
        vaccination_reminders: true,
        marketing: false,
        browser_push: false,
      },
  });
}

export async function PUT(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ ok: false, message: "로그인이 필요합니다." }, { status: 401 });
  }

  const body = (await request.json()) as Record<string, boolean>;

  const payload = {
    user_id: user.id,
    reservation_updates: body.reservation_updates !== false,
    chat_messages: body.chat_messages !== false,
    medical_updates: body.medical_updates !== false,
    medication_reminders: body.medication_reminders !== false,
    vaccination_reminders: body.vaccination_reminders !== false,
    marketing: body.marketing === true,
    browser_push: body.browser_push === true,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabaseAdmin
    .from("notification_preferences")
    .upsert(payload, { onConflict: "user_id" });

  if (error) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
