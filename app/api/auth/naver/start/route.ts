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
  const clientId = process.env.NAVER_CLIENT_ID;
  const origin = appOrigin(request);

  if (!clientId) {
    const target = new URL("/auth/login", origin);
    target.searchParams.set("error", "naver_env_missing");
    return NextResponse.redirect(target);
  }

  const state = crypto.randomBytes(24).toString("hex");
  const redirectUri = `${origin}/api/auth/naver/callback`;

  const authorizeUrl = new URL(
    "https://nid.naver.com/oauth2.0/authorize",
  );

  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("client_id", clientId);
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("state", state);

  const response = NextResponse.redirect(authorizeUrl);

  response.cookies.set("pawu_naver_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 10,
  });

  return response;
}
