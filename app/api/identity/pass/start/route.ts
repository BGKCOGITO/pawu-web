import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const startUrl = process.env.PASS_IDENTITY_START_URL;

  if (!startUrl) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "PASS 본인인증 계약 정보가 아직 설정되지 않았습니다. 현재는 문자 인증을 이용해 주세요.",
      },
      { status: 503 },
    );
  }

  const origin = new URL(request.url).origin;
  const callbackUrl = `${origin}/api/identity/pass/callback`;

  const redirectUrl = new URL(startUrl);
  redirectUrl.searchParams.set("returnUrl", callbackUrl);
  redirectUrl.searchParams.set(
    "service",
    process.env.PASS_IDENTITY_SERVICE_NAME ?? "PAWU",
  );

  return NextResponse.json({
    ok: true,
    redirectUrl: redirectUrl.toString(),
  });
}
