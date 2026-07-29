import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../lib/supabase-admin";
import {
  OTP_COOKIE_NAME,
  verifyVerificationToken,
} from "../../../../../lib/auth/otp";
import { normalizeKoreanPhone } from "../../../../../lib/auth/phone";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RegisterHospitalRequest = {
  username?: string;
  email?: string;
  password?: string;
  phone?: string;
  verificationId?: string;
};

function readCookie(request: Request, name: string) {
  const cookieHeader = request.headers.get("cookie") ?? "";

  return cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
    ?.slice(`${name}=`.length);
}

function jsonError(message: string, status: number) {
  return NextResponse.json(
    { ok: false, message },
    { status },
  );
}

export async function POST(request: Request) {
  let createdUserId: string | null = null;

  try {
    const body =
      (await request.json()) as RegisterHospitalRequest;

    const username = String(body.username ?? "")
      .trim()
      .toLowerCase();
    const email = String(body.email ?? "")
      .trim()
      .toLowerCase();
    const password = String(body.password ?? "");
    const phone = normalizeKoreanPhone(body.phone ?? "");
    const submittedVerificationId = String(
      body.verificationId ?? "",
    ).trim();

    if (!/^[a-z0-9._]{4,20}$/.test(username)) {
      return jsonError(
        "아이디 형식이 올바르지 않습니다.",
        400,
      );
    }

    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      password.length < 6 ||
      !phone ||
      !submittedVerificationId
    ) {
      return jsonError(
        "회원가입 정보가 올바르지 않습니다.",
        400,
      );
    }

    const verificationCookie = readCookie(
      request,
      OTP_COOKIE_NAME,
    );
    const verification = verifyVerificationToken(
      verificationCookie,
    );

    if (
      !verification ||
      verification.phone !== phone ||
      verification.verificationId !==
        submittedVerificationId
    ) {
      return jsonError(
        "휴대폰 인증이 만료되었습니다. 다시 인증해 주세요.",
        401,
      );
    }

    const {
      data: verificationRow,
      error: verificationError,
    } = await supabaseAdmin
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
      return jsonError(
        "사용할 수 없는 휴대폰 인증입니다.",
        409,
      );
    }

    const {
      data: usernameAvailable,
      error: usernameError,
    } = await supabaseAdmin.rpc(
      "is_username_available",
      { candidate: username },
    );

    if (usernameError) {
      throw new Error(usernameError.message);
    }

    if (!usernameAvailable) {
      return jsonError(
        "이미 사용 중인 아이디입니다.",
        409,
      );
    }

    const {
      data: created,
      error: createError,
    } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        account_type: "hospital",
        username,
        phone,
      },
    });

    if (createError || !created.user) {
      return jsonError(
        createError?.message ??
          "회원 계정을 만들지 못했습니다.",
        400,
      );
    }

    createdUserId = created.user.id;

    const { error: profileError } =
      await supabaseAdmin
        .from("profiles")
        .upsert(
          {
            id: createdUserId,
            account_type: "hospital",
            username,
            email,
            phone,
            phone_verified: true,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "id" },
        );

    if (profileError) {
      throw new Error(profileError.message);
    }

    const { error: identityError } =
      await supabaseAdmin
        .from("identity_verifications")
        .insert({
          user_id: createdUserId,
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

    const { error: consumeError } =
      await supabaseAdmin
        .from("phone_verification_requests")
        .update({
          consumed_at: new Date().toISOString(),
          user_id: createdUserId,
        })
        .eq("id", verification.verificationId)
        .is("consumed_at", null);

    if (consumeError) {
      throw new Error(consumeError.message);
    }

    const response = NextResponse.json({
      ok: true,
      userId: createdUserId,
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
    console.error(
      "병원 관리자 계정 생성 오류:",
      error,
    );

    if (createdUserId) {
      await supabaseAdmin.auth.admin.deleteUser(
        createdUserId,
      );
    }

    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "병원 관리자 계정을 만들지 못했습니다.",
      },
      { status: 400 },
    );
  }
}
