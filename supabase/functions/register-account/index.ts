import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { hmacSha256Hex } from "../_shared/crypto.ts";
import { normalizeKoreanPhone } from "../_shared/phone.ts";

type AccountType = "guardian" | "hospital";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ message: "POST 요청만 허용됩니다." }, 405);
  }

  try {
    const body = await req.json();

    const username = String(body.username ?? "").trim().toLowerCase();
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    const phone = normalizeKoreanPhone(body.phone);
    const verificationToken = String(body.verificationToken ?? "");
    const accountType = String(body.accountType ?? "") as AccountType;
    const purpose =
      accountType === "hospital"
        ? "signup_hospital"
        : "signup_guardian";

    if (!/^[a-z0-9._]{4,20}$/.test(username)) {
      return jsonResponse(
        { message: "아이디 형식이 올바르지 않습니다." },
        400,
      );
    }

    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      password.length < 6 ||
      !phone ||
      !verificationToken ||
      !["guardian", "hospital"].includes(accountType)
    ) {
      return jsonResponse(
        { message: "회원가입 정보가 올바르지 않습니다." },
        400,
      );
    }

    const otpPepper = Deno.env.get("PHONE_OTP_PEPPER");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!otpPepper || !supabaseUrl || !serviceRoleKey) {
      return jsonResponse(
        { message: "회원가입 서버 설정이 완료되지 않았습니다." },
        500,
      );
    }

    const supabaseAdmin = createClient(
      supabaseUrl,
      serviceRoleKey,
      { auth: { persistSession: false } },
    );

    const tokenHash = await hmacSha256Hex(
      otpPepper,
      verificationToken,
    );

    const { data: verification } = await supabaseAdmin
      .from("phone_verifications")
      .select("id, phone, token_expires_at, consumed_at")
      .eq("phone", phone)
      .eq("purpose", purpose)
      .eq("verification_token_hash", tokenHash)
      .not("verified_at", "is", null)
      .maybeSingle();

    if (
      !verification ||
      verification.consumed_at ||
      !verification.token_expires_at ||
      new Date(verification.token_expires_at).getTime() < Date.now()
    ) {
      return jsonResponse(
        { message: "휴대폰 인증이 만료되었습니다. 다시 인증해 주세요." },
        400,
      );
    }

    const { data: usernameAvailable, error: usernameError } =
      await supabaseAdmin.rpc("is_username_available", {
        candidate: username,
      });

    if (usernameError || !usernameAvailable) {
      return jsonResponse(
        { message: "이미 사용 중인 아이디입니다." },
        409,
      );
    }

    const { data: created, error: createError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          account_type: accountType,
          username,
          phone,
        },
      });

    if (createError || !created.user) {
  console.error("========== CREATE USER ERROR ==========");
  console.error(createError);
  console.error("message:", createError?.message);
  console.error("status:", createError?.status);
  console.error("name:", createError?.name);
  console.error("cause:", createError?.cause);
  console.error(JSON.stringify(createError, null, 2));
  console.error("=======================================");

  return jsonResponse(
    {
      message: createError?.message ?? "회원 계정을 만들지 못했습니다.",
      debug: createError,
    },
    400,
  );
}

    const userId = created.user.id;

    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .upsert({
        id: userId,
        account_type: accountType,
        username,
        email,
        phone,
        phone_verified: true,
        updated_at: new Date().toISOString(),
      });

    if (profileError) {
      console.error("프로필 저장 실패:", profileError);
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return jsonResponse(
        { message: "회원 프로필을 저장하지 못했습니다." },
        500,
      );
    }

    const { error: consumeError } = await supabaseAdmin
      .from("phone_verifications")
      .update({ consumed_at: new Date().toISOString() })
      .eq("id", verification.id)
      .is("consumed_at", null);

    if (consumeError) {
      console.error("인증 토큰 사용 처리 실패:", consumeError);
    }

    return jsonResponse({
      ok: true,
      userId,
      message: "회원 계정이 생성되었습니다.",
    });
  } catch (error) {
    console.error("register-account 오류:", error);
    return jsonResponse(
      { message: "회원가입 처리 중 오류가 발생했습니다." },
      500,
    );
  }
});
