import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

function metadataName(metadata: Record<string, unknown>) {
  const candidates = [
    metadata.display_name,
    metadata.full_name,
    metadata.name,
    metadata.nickname,
    metadata.preferred_username,
    metadata.user_name,
  ];

  for (const candidate of candidates) {
    const value = String(candidate ?? "").trim();
    if (value) return value;
  }

  return "";
}

export async function POST(request: Request) {
  try {
    const authorization = request.headers.get("authorization");

    if (!authorization?.startsWith("Bearer ")) {
      return NextResponse.json(
        { ok: false, message: "로그인 세션이 필요합니다." },
        { status: 401 },
      );
    }

    const accessToken = authorization.slice("Bearer ".length);
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
        { ok: false, message: "유효하지 않은 로그인 세션입니다." },
        { status: 401 },
      );
    }

    const [{ data: superAdmin }, { data: hospitalAdmin }, profileResult] =
      await Promise.all([
        supabaseAdmin
          .from("super_admins")
          .select("user_id")
          .eq("user_id", user.id)
          .maybeSingle(),
        supabaseAdmin
          .from("hospital_admins")
          .select("hospital_id")
          .eq("user_id", user.id)
          .maybeSingle(),
        supabaseAdmin
          .from("profiles")
          .select(
            "id,email,display_name,phone,account_type,auth_provider,profile_completed_at",
          )
          .eq("id", user.id)
          .maybeSingle(),
      ]);

    if (superAdmin?.user_id) {
      return NextResponse.json({
        ok: true,
        redirectPath: "/super-admin/hospitals",
        needsProfile: false,
      });
    }

    if (hospitalAdmin?.hospital_id) {
      return NextResponse.json({
        ok: true,
        redirectPath: "/hospital-admin/dashboard",
        needsProfile: false,
      });
    }

    const provider = String(
      user.app_metadata?.provider ??
        user.user_metadata?.provider ??
        "social",
    );

    const metadata = user.user_metadata as Record<string, unknown>;
    const inferredName =
      metadataName(metadata) ||
      String(user.email ?? "").split("@")[0] ||
      "";

    const inferredPhone = String(
      user.phone ??
        metadata.phone ??
        metadata.phone_number ??
        "",
    ).trim();

    const existing = profileResult.data;

    const displayName =
      String(existing?.display_name ?? "").trim() || inferredName;
    const phone = String(existing?.phone ?? "").trim() || inferredPhone;

    const syntheticEmail =
      user.user_metadata?.email_is_synthetic === true ||
      String(user.email ?? "").endsWith("@kakao.pawu.local") ||
      String(user.email ?? "").endsWith("@naver.pawu.local");

    const profilePayload: Record<string, unknown> = {
      id: user.id,
      email: syntheticEmail
        ? null
        : existing?.email ?? user.email ?? null,
      account_type: existing?.account_type ?? "guardian",
      auth_provider: existing?.auth_provider ?? provider,
    };

    if (displayName) profilePayload.display_name = displayName;
    if (phone) profilePayload.phone = phone;

    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .upsert(profilePayload, { onConflict: "id" });

    if (profileError) {
      throw new Error(profileError.message);
    }

    const needsProfile = !displayName || !phone;

    if (!needsProfile && !existing?.profile_completed_at) {
      await supabaseAdmin
        .from("profiles")
        .update({
          profile_completed_at: new Date().toISOString(),
        })
        .eq("id", user.id);
    }

    return NextResponse.json({
      ok: true,
      redirectPath: needsProfile ? "/auth/social-profile" : "/",
      needsProfile,
      provider,
    });
  } catch (error) {
    console.error("소셜 로그인 완료 API 오류:", error);

    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "소셜 로그인 완료 처리에 실패했습니다.",
      },
      { status: 400 },
    );
  }
}
