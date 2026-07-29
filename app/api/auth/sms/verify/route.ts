import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../lib/supabase-admin";
import {
  createVerificationToken,
  hashOtp,
  OTP_COOKIE_NAME,
  safeEqualHex,
} from "../../../../../lib/auth/otp";
import { normalizeKoreanPhone } from "../../../../../lib/auth/phone";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      verificationId?: string;
      phone?: string;
      code?: string;
    };

    const verificationId = String(
      body.verificationId ?? "",
    ).trim();
    const phone = normalizeKoreanPhone(body.phone ?? "");
    const code = String(body.code ?? "").trim();

    if (
      !verificationId ||
      !/^\d{6}$/.test(code)
    ) {
      return NextResponse.json(
        {
          ok: false,
          message: "인증번호 6자리를 정확히 입력해 주세요.",
        },
        { status: 400 },
      );
    }

    const { data: row, error } = await supabaseAdmin
      .from("phone_verification_requests")
      .select(
        "id, phone, code_hash, expires_at, attempt_count, verified_at, consumed_at",
      )
      .eq("id", verificationId)
      .eq("phone", phone)
      .maybeSingle();

    if (error || !row) {
      return NextResponse.json(
        {
          ok: false,
          message: "인증 요청을 찾을 수 없습니다.",
        },
        { status: 404 },
      );
    }

    if (row.consumed_at) {
      return NextResponse.json(
        {
          ok: false,
          message: "이미 사용된 인증입니다.",
        },
        { status: 409 },
      );
    }

    if (row.verified_at) {
      return NextResponse.json(
        {
          ok: false,
          message: "이미 인증이 완료되었습니다.",
        },
        { status: 409 },
      );
    }

    if (new Date(row.expires_at).getTime() <= Date.now()) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "인증번호가 만료되었습니다. 다시 발송해 주세요.",
        },
        { status: 410 },
      );
    }

    if ((row.attempt_count ?? 0) >= 5) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "인증번호 입력 횟수를 초과했습니다. 다시 발송해 주세요.",
        },
        { status: 429 },
      );
    }

    const submittedHash = hashOtp({
      verificationId,
      phone,
      code,
    });

    if (!safeEqualHex(row.code_hash, submittedHash)) {
      await supabaseAdmin
        .from("phone_verification_requests")
        .update({
          attempt_count: (row.attempt_count ?? 0) + 1,
        })
        .eq("id", verificationId);

      return NextResponse.json(
        {
          ok: false,
          message: "인증번호가 올바르지 않습니다.",
        },
        { status: 400 },
      );
    }

    const verifiedAt = new Date().toISOString();

    const { error: updateError } = await supabaseAdmin
      .from("phone_verification_requests")
      .update({
        verified_at: verifiedAt,
      })
      .eq("id", verificationId)
      .is("verified_at", null);

    if (updateError) {
      throw new Error(updateError.message);
    }

    const tokenExpiresAt = Date.now() + 20 * 60_000;
    const token = createVerificationToken({
      phone,
      verificationId,
      expiresAt: tokenExpiresAt,
    });

    const response = NextResponse.json({
      ok: true,
      phone,
      expiresInSeconds: 1200,
    });

    response.cookies.set({
      name: OTP_COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 20 * 60,
    });

    return response;
  } catch (error) {
    console.error("휴대폰 인증번호 검증 오류:", error);

    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "인증번호를 확인하지 못했습니다.",
      },
      { status: 400 },
    );
  }
}
