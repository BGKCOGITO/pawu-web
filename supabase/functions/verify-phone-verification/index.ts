import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import {
  hmacSha256Hex,
  randomHex,
  timingSafeEqual,
} from "../_shared/crypto.ts";
import { normalizeKoreanPhone } from "../_shared/phone.ts";

type Purpose = "signup_guardian" | "signup_hospital";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ message: "POST 요청만 허용됩니다." }, 405);
  }

  try {
    const body = await req.json();
    const phone = normalizeKoreanPhone(body.phone);
    const requestId = String(body.requestId ?? "");
    const code = String(body.code ?? "").trim();
    const purpose = String(body.purpose ?? "") as Purpose;

    if (
      !phone ||
      !requestId ||
      !/^\d{6}$/.test(code) ||
      !["signup_guardian", "signup_hospital"].includes(purpose)
    ) {
      return jsonResponse(
        { message: "인증 요청 정보가 올바르지 않습니다." },
        400,
      );
    }

    const otpPepper = Deno.env.get("PHONE_OTP_PEPPER");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!otpPepper || !supabaseUrl || !serviceRoleKey) {
      return jsonResponse(
        { message: "문자 인증 서버 설정이 완료되지 않았습니다." },
        500,
      );
    }

    const supabaseAdmin = createClient(
      supabaseUrl,
      serviceRoleKey,
      { auth: { persistSession: false } },
    );

    const { data: verification, error } = await supabaseAdmin
      .from("phone_verifications")
      .select("*")
      .eq("id", requestId)
      .eq("phone", phone)
      .eq("purpose", purpose)
      .maybeSingle();

    if (error || !verification) {
      return jsonResponse(
        { message: "인증 요청을 찾지 못했습니다." },
        404,
      );
    }

    if (
      verification.consumed_at ||
      verification.verified_at ||
      new Date(verification.expires_at).getTime() < Date.now()
    ) {
      return jsonResponse(
        { message: "인증번호가 만료되었습니다. 다시 발송해 주세요." },
        400,
      );
    }

    if (verification.attempts >= 5) {
      return jsonResponse(
        { message: "인증 시도 횟수를 초과했습니다." },
        429,
      );
    }

    const suppliedHash = await hmacSha256Hex(
      otpPepper,
      `${phone}:${purpose}:${code}`,
    );

    if (!timingSafeEqual(suppliedHash, verification.code_hash)) {
      await supabaseAdmin
        .from("phone_verifications")
        .update({ attempts: verification.attempts + 1 })
        .eq("id", requestId);

      return jsonResponse(
        { message: "인증번호가 올바르지 않습니다." },
        400,
      );
    }

    const verificationToken = randomHex(32);
    const verificationTokenHash = await hmacSha256Hex(
      otpPepper,
      verificationToken,
    );
    const tokenExpiresAt = new Date(
      Date.now() + 10 * 60_000,
    ).toISOString();

    const { error: updateError } = await supabaseAdmin
      .from("phone_verifications")
      .update({
        verified_at: new Date().toISOString(),
        verification_token_hash: verificationTokenHash,
        token_expires_at: tokenExpiresAt,
      })
      .eq("id", requestId);

    if (updateError) {
      console.error("인증 완료 저장 실패:", updateError);
      return jsonResponse(
        { message: "인증 완료 정보를 저장하지 못했습니다." },
        500,
      );
    }

    return jsonResponse({
      ok: true,
      verificationToken,
      expiresInSeconds: 600,
      message: "휴대폰 인증이 완료되었습니다.",
    });
  } catch (error) {
    console.error("verify-phone-verification 오류:", error);
    return jsonResponse(
      { message: "인증번호 확인 중 오류가 발생했습니다." },
      500,
    );
  }
});
