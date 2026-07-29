import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const result = url.searchParams.get("result");

  if (result !== "success") {
    return NextResponse.redirect(
      new URL(
        "/auth/signup?identity=failed",
        url.origin,
      ),
    );
  }

  /*
   * 중요:
   * 실제 PASS 본인확인기관 연동 시에는 여기에서 브라우저 파라미터를
   * 그대로 신뢰하면 안 됩니다.
   *
   * 인증기관 서버 API로 거래번호를 재조회하고 서명 또는 암호문을
   * 검증한 뒤, 검증된 CI/DI와 휴대폰 번호를 서버 세션에 저장해야 합니다.
   * 제공사별 요청·응답 규격이 다르므로 계약 후 받은 공식 문서에 맞춰
   * 이 파일을 교체하세요.
   */

  return NextResponse.redirect(
    new URL(
      "/auth/signup?identity=pass-config-required",
      url.origin,
    ),
  );
}
