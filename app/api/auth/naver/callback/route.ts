import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

type NaverTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  token_type?: string;
  expires_in?: string;
  error?: string;
  error_description?: string;
};

type NaverProfileResponse = {
  resultcode?: string;
  message?: string;
  response?: {
    id?: string;
    nickname?: string;
    name?: string;
    email?: string;
    profile_image?: string;
    mobile?: string;
    mobile_e164?: string;
  };
};

function appOrigin(request: NextRequest) {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
    request.nextUrl.origin
  );
}

function syntheticEmail(naverId: string) {
  return `naver_${naverId}@naver.pawu.local`;
}

function randomPassword() {
  return crypto.randomBytes(36).toString("base64url");
}

function hashRedirect(
  origin: string,
  session: {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    token_type: string;
  },
) {
  const target = new URL("/auth/social-complete", origin);
  const hash = new URLSearchParams({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_in: String(session.expires_in),
    token_type: session.token_type,
    type: "signup",
  });

  return `${target.toString()}#${hash.toString()}`;
}

function normalizePhone(value: string | undefined) {
  return String(value ?? "").replace(/\D/g, "");
}

export async function GET(request: NextRequest) {
  const origin = appOrigin(request);
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const error = request.nextUrl.searchParams.get("error");
  const errorDescription =
    request.nextUrl.searchParams.get("error_description");
  const savedState = request.cookies.get(
    "pawu_naver_oauth_state",
  )?.value;

  if (error) {
    const target = new URL("/auth/login", origin);
    target.searchParams.set("error", "naver_cancelled");
    if (errorDescription) {
      target.searchParams.set("message", errorDescription);
    }
    return NextResponse.redirect(target);
  }

  if (!code || !state || !savedState || state !== savedState) {
    return NextResponse.redirect(
      new URL("/auth/login?error=naver_state", origin),
    );
  }

  const clientId = process.env.NAVER_CLIENT_ID;
  const clientSecret = process.env.NAVER_CLIENT_SECRET;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!clientId || !clientSecret || !supabaseUrl || !supabaseKey) {
    return NextResponse.redirect(
      new URL("/auth/login?error=naver_env_missing", origin),
    );
  }

  try {
    const tokenUrl = new URL(
      "https://nid.naver.com/oauth2.0/token",
    );

    tokenUrl.searchParams.set("grant_type", "authorization_code");
    tokenUrl.searchParams.set("client_id", clientId);
    tokenUrl.searchParams.set("client_secret", clientSecret);
    tokenUrl.searchParams.set("code", code);
    tokenUrl.searchParams.set("state", state);

    const tokenResponse = await fetch(tokenUrl, {
      method: "GET",
      cache: "no-store",
    });

    const token = (await tokenResponse.json()) as NaverTokenResponse;

    if (!tokenResponse.ok || !token.access_token) {
      throw new Error(
        token.error_description ??
          token.error ??
          "네이버 접근 토큰 발급에 실패했습니다.",
      );
    }

    const profileResponse = await fetch(
      "https://openapi.naver.com/v1/nid/me",
      {
        headers: {
          authorization: `Bearer ${token.access_token}`,
        },
        cache: "no-store",
      },
    );

    const profile =
      (await profileResponse.json()) as NaverProfileResponse;

    if (
      !profileResponse.ok ||
      profile.resultcode !== "00" ||
      !profile.response?.id
    ) {
      throw new Error(
        profile.message ??
          "네이버 사용자 정보를 확인하지 못했습니다.",
      );
    }

    const naver = profile.response;
    const email = syntheticEmail(String(naver.id));
    const password = randomPassword();
    const displayName =
      String(naver.name ?? naver.nickname ?? "").trim() ||
      "네이버 회원";
    const phone = normalizePhone(
      naver.mobile ?? naver.mobile_e164,
    );
    const avatarUrl = naver.profile_image ?? null;

    const { data: listed, error: listError } =
      await supabaseAdmin.auth.admin.listUsers({
        page: 1,
        perPage: 1000,
      });

    if (listError) {
      throw new Error(listError.message);
    }

    let authUser = listed.users.find(
      (user) => user.email === email,
    );

    if (!authUser) {
      const { data, error: createError } =
        await supabaseAdmin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: {
            provider: "naver",
            nickname: naver.nickname ?? null,
            full_name: displayName,
            avatar_url: avatarUrl,
            naver_id: naver.id,
            email_is_synthetic: true,
          },
          app_metadata: {
            provider: "naver",
            providers: ["naver"],
          },
        });

      if (createError || !data.user) {
        throw new Error(
          createError?.message ??
            "PAWU 네이버 계정 생성에 실패했습니다.",
        );
      }

      authUser = data.user;
    } else {
      const { data, error: updateError } =
        await supabaseAdmin.auth.admin.updateUserById(
          authUser.id,
          {
            password,
            email_confirm: true,
            user_metadata: {
              ...authUser.user_metadata,
              provider: "naver",
              nickname: naver.nickname ?? null,
              full_name: displayName,
              avatar_url: avatarUrl,
              naver_id: naver.id,
              email_is_synthetic: true,
            },
          },
        );

      if (updateError || !data.user) {
        throw new Error(
          updateError?.message ??
            "네이버 계정 로그인 준비에 실패했습니다.",
        );
      }

      authUser = data.user;
    }

    await supabaseAdmin
      .from("profiles")
      .upsert(
        {
          id: authUser.id,
          email: null,
          display_name: displayName,
          phone: phone || null,
          account_type: "guardian",
          auth_provider: "naver",
          profile_completed_at:
            displayName && phone
              ? new Date().toISOString()
              : null,
        },
        { onConflict: "id" },
      );

    const authClient = createClient(
      supabaseUrl,
      supabaseKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      },
    );

    const { data: signInData, error: signInError } =
      await authClient.auth.signInWithPassword({
        email,
        password,
      });

    if (signInError || !signInData.session) {
      throw new Error(
        signInError?.message ??
          "PAWU 로그인 세션 생성에 실패했습니다.",
      );
    }

    const response = NextResponse.redirect(
      hashRedirect(origin, signInData.session),
    );

    response.cookies.delete("pawu_naver_oauth_state");

    return response;
  } catch (caughtError) {
    console.error("네이버 직접 로그인 오류:", caughtError);

    const target = new URL("/auth/login", origin);
    target.searchParams.set("error", "naver_direct");
    target.searchParams.set(
      "message",
      caughtError instanceof Error
        ? caughtError.message
        : "네이버 로그인에 실패했습니다.",
    );

    return NextResponse.redirect(target);
  }
}
