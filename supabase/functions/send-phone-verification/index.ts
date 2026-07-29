import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import {
  hmacSha256Hex,
  randomDigits,
  randomHex,
} from "../_shared/crypto.ts";
import {
  getRequestIp,
  normalizeKoreanPhone,
} from "../_shared/phone.ts";

type Purpose = "signup_guardian" | "signup_hospital";

const allowedPurposes = new Set<Purpose>([
  "signup_guardian",
  "signup_hospital",
]);

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
    const purpose = String(body.purpose ?? "") as Purpose;

    if (!phone || !allowedPurposes.has(purpose)) {
      return jsonResponse(
        { message: "휴대폰 번호 또는 인증 목적이 올바르지 않습니다." },
        400,
      );
    }

    const apiKey = Deno.env.get("SOLAPI_API_KEY");
    const apiSecret = Deno.env.get("SOLAPI_API_SECRET");
    const sender = Deno.env.get("SOLAPI_SENDER");
    const otpPepper = Deno.env.get("PHONE_OTP_PEPPER");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (
      !apiKey ||
      !apiSecret ||
      !sender ||
      !otpPepper ||
      !supabaseUrl ||
      !serviceRoleKey
    ) {
      console.error("필수 Edge Function Secret이 없습니다.");
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

    const requestIp = getRequestIp(req);
    const now = new Date();
    const oneMinuteAgo = new Date(now.getTime() - 60_000).toISOString();
    const oneDayAgo = new Date(now.getTime() - 86_400_000).toISOString();

    const { count: recentPhoneCount } = await supabaseAdmin
      .from("phone_verifications")
      .select("id", { count: "exact", head: true })
      .eq("phone", phone)
      .gte("created_at", oneMinuteAgo);

    if ((recentPhoneCount ?? 0) > 0) {
      return jsonResponse(
        { message: "인증번호는 60초 후 다시 요청할 수 있습니다." },
        429,
      );
    }

    const { count: dailyPhoneCount } = await supabaseAdmin
      .from("phone_verifications")
      .select("id", { count: "exact", head: true })
      .eq("phone", phone)
      .gte("created_at", oneDayAgo);

    if ((dailyPhoneCount ?? 0) >= 10) {
      return jsonResponse(
        { message: "오늘 인증번호 발송 한도를 초과했습니다." },
        429,
      );
    }

    if (requestIp) {
      const { count: hourlyIpCount } = await supabaseAdmin
        .from("phone_verifications")
        .select("id", { count: "exact", head: true })
        .eq("request_ip", requestIp)
        .gte(
          "created_at",
          new Date(now.getTime() - 3_600_000).toISOString(),
        );

      if ((hourlyIpCount ?? 0) >= 20) {
        return jsonResponse(
          { message: "잠시 후 다시 시도해 주세요." },
          429,
        );
      }
    }

    const code = randomDigits(6);
    const codeHash = await hmacSha256Hex(
      otpPepper,
      `${phone}:${purpose}:${code}`,
    );
    const expiresAt = new Date(now.getTime() + 3 * 60_000).toISOString();

    const { data: verification, error: insertError } =
      await supabaseAdmin
        .from("phone_verifications")
        .insert({
          phone,
          purpose,
          code_hash: codeHash,
          request_ip: requestIp,
          expires_at: expiresAt,
        })
        .select("id")
        .single();

    if (insertError || !verification) {
      console.error("인증번호 저장 실패:", insertError);
      return jsonResponse(
        { message: "인증번호를 준비하지 못했습니다." },
        500,
      );
    }

    const dateTime = new Date().toISOString();
    const salt = randomHex(16);
    const signature = await hmacSha256Hex(
      apiSecret,
      dateTime + salt,
    );
    const authorization =
      `HMAC-SHA256 apiKey=${apiKey}, date=${dateTime}, ` +
      `salt=${salt}, signature=${signature}`;

    const solapiResponse = await fetch(
      "https://api.solapi.com/messages/v4/send-many/detail",
      {
        method: "POST",
        headers: {
          Authorization: authorization,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: [
            {
              to: phone,
              from: sender.replace(/\D/g, ""),
              text: `[PAWU] 인증번호는 ${code}입니다. 3분 안에 입력해 주세요.`,
              type: "SMS",
              country: "82",
            },
          ],
          strict: true,
          showMessageList: true,
        }),
      },
    );

    const solapiResult = await solapiResponse.json();

    if (!solapiResponse.ok) {
      console.error("SOLAPI 발송 실패:", solapiResult);
      await supabaseAdmin
        .from("phone_verifications")
        .delete()
        .eq("id", verification.id);

      return jsonResponse(
        { message: "인증문자를 발송하지 못했습니다." },
        502,
      );
    }

    const failedCount =
      solapiResult?.groupInfo?.count?.registeredFailed ?? 0;

    if (failedCount > 0) {
      console.error("SOLAPI 문자 접수 실패:", solapiResult);
      await supabaseAdmin
        .from("phone_verifications")
        .delete()
        .eq("id", verification.id);

      return jsonResponse(
        {
          message:
            solapiResult?.failedMessageList?.[0]?.statusMessage
            ?? "인증문자 접수에 실패했습니다.",
        },
        502,
      );
    }

    return jsonResponse({
      ok: true,
      requestId: verification.id,
      expiresInSeconds: 180,
      message: "인증번호를 발송했습니다.",
    });
  } catch (error) {
    console.error("send-phone-verification 오류:", error);
    return jsonResponse(
      { message: "인증번호 발송 중 오류가 발생했습니다." },
      500,
    );
  }
});
