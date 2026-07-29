import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";

export const runtime = "nodejs";

function appOrigin(request: NextRequest) {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
    request.nextUrl.origin
  );
}

export async function GET(request: NextRequest) {
  const clientId = process.env.KAKAO_REST_API_KEY;

  if (!clientId) {
    return NextResponse.redirect(
      new URL(
        "/auth/login?error=kakao_env_missing",
        appOrigin(request),
      ),
    );
  }

  const state = crypto.randomBytes(24).toString("hex");
  const redirectUri = `${appOrigin(request)}/api/auth/kakao/callback`;

  const authorizeUrl = new URL(
    "https://kauth.kakao.com/oauth/authorize",
  );

  authorizeUrl.searchParams.set("client_id", clientId);
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("state", state);

  /*
   * 이메일을 요청하지 않습니다.
   * 현재 Kakao Developers에서 활성화한 항목만 요청합니다.
   */
  authorizeUrl.searchParams.set(
    "scope",
    "profile_nickname profile_image",
  );

  const response = NextResponse.redirect(authorizeUrl);

  response.cookies.set("pawu_kakao_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 10,
  });

  return response;
}
