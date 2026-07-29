import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "../../../../../../lib/supabase-admin";
import {
  OTP_COOKIE_NAME,
  verifyVerificationToken,
} from "../../../../../../lib/auth/otp";

export const runtime = "nodejs";

type ConsentPayload = {
  terms: boolean;
  privacy: boolean;
  identity: boolean;
  age14: boolean;
  marketing: boolean;
};

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
    const supabaseAnonKey =
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error("Supabase 공개 환경변수가 필요합니다.");
    }

    const authClient = createClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      },
    );

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

    const cookieHeader = request.headers.get("cookie") ?? "";
    const cookieValue = cookieHeader
      .split(";")
      .map((part) => part.trim())
      .find((part) =>
        part.startsWith(`${OTP_COOKIE_NAME}=`),
      )
      ?.slice(`${OTP_COOKIE_NAME}=`.length);

    const verification = verifyVerificationToken(cookieValue);

    if (!verification) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "휴대폰 인증이 만료되었습니다. 다시 인증해 주세요.",
        },
        { status: 401 },
      );
    }

    const body = (await request.json()) as {
      policyVersion?: string;
      consents?: ConsentPayload;
      provider?: string;
    };

    const policyVersion = String(
      body.policyVersion ?? "",
    ).trim();
    const consents = body.consents;

    if (
      !policyVersion ||
      !consents?.terms ||
      !consents.privacy ||
      !consents.identity ||
      !consents.age14
    ) {
      return NextResponse.json(
        {
          ok: false,
          message: "필수 약관 동의 정보가 없습니다.",
        },
        { status: 400 },
      );
    }

    const { data: verificationRow, error: verificationError } =
      await supabaseAdmin
        .from("phone_verification_requests")
        .select(
          "id, phone, verified_at, consumed_at, expires_at",
        )
        .eq("id", verification.verificationId)
        .eq("phone", verification.phone)
        .maybeSingle();

    if (
      verificationError ||
      !verificationRow ||
      !verificationRow.verified_at ||
      verificationRow.consumed_at
    ) {
      return NextResponse.json(
        {
          ok: false,
          message: "사용할 수 없는 휴대폰 인증입니다.",
        },
        { status: 409 },
      );
    }

    const consentRows = [
      ["terms_of_service", consents.terms],
      ["privacy_required", consents.privacy],
      ["identity_verification", consents.identity],
      ["age_14_or_older", consents.age14],
      ["marketing", consents.marketing],
    ].map(([consentType, isAgreed]) => ({
      user_id: user.id,
      consent_type: consentType,
      policy_version: policyVersion,
      is_agreed: Boolean(isAgreed),
      agreed_at: isAgreed ? new Date().toISOString() : null,
      revoked_at: isAgreed ? null : new Date().toISOString(),
    }));

    const { error: consentError } = await supabaseAdmin
      .from("user_consents")
      .upsert(consentRows, {
        onConflict: "user_id,consent_type,policy_version",
      });

    if (consentError) {
      throw new Error(consentError.message);
    }

    const email =
      user.email ??
      (String(user.user_metadata?.email ?? "").trim() || null);

    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .upsert(
        {
          id: user.id,
          account_type: "guardian",
          email,
          phone: verification.phone,
          phone_verified: true,
        },
        { onConflict: "id" },
      );

    if (profileError) {
      throw new Error(profileError.message);
    }

    const { error: identityError } = await supabaseAdmin
      .from("identity_verifications")
      .insert({
        user_id: user.id,
        provider: "solapi",
        method: "sms",
        transaction_id: verification.verificationId,
        phone_number: verification.phone,
        verified_at: verificationRow.verified_at,
      });

    if (
      identityError &&
      identityError.code !== "23505"
    ) {
      throw new Error(identityError.message);
    }

    const { error: consumeError } = await supabaseAdmin
      .from("phone_verification_requests")
      .update({
        consumed_at: new Date().toISOString(),
        user_id: user.id,
      })
      .eq("id", verification.verificationId)
      .is("consumed_at", null);

    if (consumeError) {
      throw new Error(consumeError.message);
    }

    const response = NextResponse.json({
      ok: true,
      userId: user.id,
      provider: body.provider ?? "email",
    });

    response.cookies.set({
      name: OTP_COOKIE_NAME,
      value: "",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });

    return response;
  } catch (error) {
    console.error("회원가입 완료 처리 오류:", error);

    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "회원가입 완료 처리를 실패했습니다.",
      },
      { status: 400 },
    );
  }
}
