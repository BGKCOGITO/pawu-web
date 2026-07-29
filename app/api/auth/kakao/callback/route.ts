import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

type KakaoTokenResponse = {
  access_token?: string;
  token_type?: string;
  refresh_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
};

type KakaoUserResponse = {
  id?: number;
  properties?: {
    nickname?: string;
    profile_image?: string;
    thumbnail_image?: string;
  };
  kakao_account?: {
    profile?: {
      nickname?: string;
      profile_image_url?: string;
      thumbnail_image_url?: string;
    };
  };
};

function appOrigin(request: NextRequest) {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
    request.nextUrl.origin
  );
}

function syntheticEmail(kakaoId: number) {
  return `kakao_${kakaoId}@kakao.pawu.local`;
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

export async function GET(request: NextRequest) {
  const origin = appOrigin(request);
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const error = request.nextUrl.searchParams.get("error");
  const savedState = request.cookies.get(
    "pawu_kakao_oauth_state",
  )?.value;

  if (error) {
    return NextResponse.redirect(
      new URL("/auth/login?error=kakao_cancelled", origin),
    );
  }

  if (!code || !state || !savedState || state !== savedState) {
    return NextResponse.redirect(
      new URL("/auth/login?error=kakao_state", origin),
    );
  }

  const clientId = process.env.KAKAO_REST_API_KEY;
  const clientSecret = process.env.KAKAO_CLIENT_SECRET;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!clientId || !supabaseUrl || !supabaseKey) {
    return NextResponse.redirect(
      new URL("/auth/login?error=kakao_env_missing", origin),
    );
  }

  const redirectUri = `${origin}/api/auth/kakao/callback`;

  try {
    const tokenBody = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: clientId,
      redirect_uri: redirectUri,
      code,
    });

    if (clientSecret) {
      tokenBody.set("client_secret", clientSecret);
    }

    const tokenResponse = await fetch(
      "https://kauth.kakao.com/oauth/token",
      {
        method: "POST",
        headers: {
          "content-type":
            "application/x-www-form-urlencoded;charset=utf-8",
        },
        body: tokenBody.toString(),
        cache: "no-store",
      },
    );

    const token = (await tokenResponse.json()) as KakaoTokenResponse;

    if (!tokenResponse.ok || !token.access_token) {
      throw new Error(
        token.error_description ??
          token.error ??
          "카카오 토큰 발급에 실패했습니다.",
      );
    }

    const userResponse = await fetch(
      "https://kapi.kakao.com/v2/user/me",
      {
        headers: {
          authorization: `Bearer ${token.access_token}`,
        },
        cache: "no-store",
      },
    );

    const kakaoUser =
      (await userResponse.json()) as KakaoUserResponse;

    if (!userResponse.ok || !kakaoUser.id) {
      throw new Error("카카오 사용자 정보를 확인하지 못했습니다.");
    }

    const email = syntheticEmail(kakaoUser.id);
    const password = randomPassword();
    const nickname =
      kakaoUser.kakao_account?.profile?.nickname ??
      kakaoUser.properties?.nickname ??
      "카카오 회원";
    const avatarUrl =
      kakaoUser.kakao_account?.profile?.profile_image_url ??
      kakaoUser.properties?.profile_image ??
      null;

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
            provider: "kakao",
            nickname,
            full_name: nickname,
            avatar_url: avatarUrl,
            kakao_id: String(kakaoUser.id),
            email_is_synthetic: true,
          },
          app_metadata: {
            provider: "kakao",
            providers: ["kakao"],
          },
        });

      if (createError || !data.user) {
        throw new Error(
          createError?.message ?? "PAWU 계정 생성에 실패했습니다.",
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
              provider: "kakao",
              nickname,
              full_name: nickname,
              avatar_url: avatarUrl,
              kakao_id: String(kakaoUser.id),
              email_is_synthetic: true,
            },
          },
        );

      if (updateError || !data.user) {
        throw new Error(
          updateError?.message ??
            "카카오 계정 로그인 준비에 실패했습니다.",
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
          display_name: nickname,
          account_type: "guardian",
          auth_provider: "kakao",
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
        signInError?.message ?? "PAWU 로그인 세션 생성에 실패했습니다.",
      );
    }

    const response = NextResponse.redirect(
      hashRedirect(origin, signInData.session),
    );

    response.cookies.delete("pawu_kakao_oauth_state");

    return response;
  } catch (caughtError) {
    console.error("카카오 직접 로그인 오류:", caughtError);

    const target = new URL("/auth/login", origin);
    target.searchParams.set("error", "kakao_direct");
    target.searchParams.set(
      "message",
      caughtError instanceof Error
        ? caughtError.message
        : "카카오 로그인에 실패했습니다.",
    );

    return NextResponse.redirect(target);
  }
}
