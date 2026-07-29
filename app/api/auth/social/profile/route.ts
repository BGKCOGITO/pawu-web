import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

export async function PATCH(request: Request) {
  try {
    const authorization = request.headers.get("authorization");

    if (!authorization?.startsWith("Bearer ")) {
      return NextResponse.json(
        { ok: false, message: "로그인 세션이 필요합니다." },
        { status: 401 },
      );
    }

    const accessToken = authorization.slice("Bearer ".length);
    const body = (await request.json()) as {
      displayName?: string;
      phone?: string;
    };

    const displayName = String(body.displayName ?? "").trim();
    const phone = String(body.phone ?? "").replace(/\D/g, "");

    if (displayName.length < 2) {
      return NextResponse.json(
        { ok: false, message: "이름을 2자 이상 입력해 주세요." },
        { status: 400 },
      );
    }

    if (phone.length < 10 || phone.length > 11) {
      return NextResponse.json(
        { ok: false, message: "휴대폰 번호를 정확히 입력해 주세요." },
        { status: 400 },
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey =
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Supabase 공개 환경변수가 필요합니다.");
    }

    const authClient = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const {
      data: { user },
      error: userError,
    } = await authClient.auth.getUser(accessToken);

    if (userError || !user) {
      return NextResponse.json(
        { ok: false, message: "로그인 정보가 만료되었습니다." },
        { status: 401 },
      );
    }

    const { error } = await supabaseAdmin
      .from("profiles")
      .upsert(
        {
          id: user.id,
          email: user.email ?? null,
          display_name: displayName,
          phone,
          account_type: "guardian",
          auth_provider:
            user.app_metadata?.provider ??
            user.user_metadata?.provider ??
            "social",
          profile_completed_at: new Date().toISOString(),
        },
        { onConflict: "id" },
      );

    if (error) throw new Error(error.message);

    return NextResponse.json({ ok: true, redirectPath: "/" });
  } catch (error) {
    console.error("소셜 프로필 저장 오류:", error);

    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "프로필 저장에 실패했습니다.",
      },
      { status: 400 },
    );
  }
}
