import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { SolapiMessageService } from "solapi";
import { supabaseAdmin } from "../../../../../lib/supabase-admin";
import {
  createOtpCode,
  hashOtp,
} from "../../../../../lib/auth/otp";
import {
  maskPhone,
  normalizeKoreanPhone,
} from "../../../../../lib/auth/phone";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SendSmsRequest = {
  phone?: string;
};

function getClientIp(request: Request) {
  return (
    request.headers
      .get("x-forwarded-for")
      ?.split(",")[0]
      ?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }

  return String(error);
}

function errorResponse(
  message: string,
  status = 400,
  detail?: string,
) {
  return NextResponse.json(
    {
      ok: false,
      message,
      ...(process.env.NODE_ENV !== "production" && detail
        ? { detail }
        : {}),
    },
    { status },
  );
}

export async function POST(request: Request) {
  let verificationId: string | null = null;

  try {
    const body = (await request.json()) as SendSmsRequest;
    const phone = normalizeKoreanPhone(body.phone ?? "");
    const ipAddress = getClientIp(request);

    const now = new Date();
    const oneMinuteAgo = new Date(
      now.getTime() - 60_000,
    ).toISOString();
    const oneHourAgo = new Date(
      now.getTime() - 60 * 60_000,
    ).toISOString();

    /*
     * 1. 인증 요청 제한 확인
     */
    const [
      recentPhoneResult,
      hourlyPhoneResult,
      hourlyIpResult,
    ] = await Promise.all([
      supabaseAdmin
        .from("phone_verification_requests")
        .select("id", { count: "exact", head: true })
        .eq("phone", phone)
        .gte("created_at", oneMinuteAgo),

      supabaseAdmin
        .from("phone_verification_requests")
        .select("id", { count: "exact", head: true })
        .eq("phone", phone)
        .gte("created_at", oneHourAgo),

      supabaseAdmin
        .from("phone_verification_requests")
        .select("id", { count: "exact", head: true })
        .eq("ip_address", ipAddress)
        .gte("created_at", oneHourAgo),
    ]);

    const limitCheckError =
      recentPhoneResult.error ??
      hourlyPhoneResult.error ??
      hourlyIpResult.error;

    if (limitCheckError) {
      const detail = getErrorMessage(limitCheckError);

      console.error(
        "[PAWU SMS] 인증 요청 제한 조회 실패:",
        limitCheckError,
      );

      return errorResponse(
        "인증 요청 제한을 확인하지 못했습니다.",
        500,
        detail,
      );
    }

    if ((recentPhoneResult.count ?? 0) >= 1) {
      return errorResponse(
        "인증번호는 1분 후 다시 요청할 수 있습니다.",
        429,
      );
    }

    if ((hourlyPhoneResult.count ?? 0) >= 5) {
      return errorResponse(
        "해당 번호의 인증 요청 횟수를 초과했습니다. 잠시 후 다시 시도해 주세요.",
        429,
      );
    }

    if ((hourlyIpResult.count ?? 0) >= 20) {
      return errorResponse(
        "인증 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.",
        429,
      );
    }

    /*
     * 2. 인증번호 생성 및 DB 저장
     */
    verificationId = randomUUID();

    const code = createOtpCode();
    const codeHash = hashOtp({
      verificationId,
      phone,
      code,
    });

    const expiresAt = new Date(
      now.getTime() + 3 * 60_000,
    ).toISOString();

    const { error: insertError } = await supabaseAdmin
      .from("phone_verification_requests")
      .insert({
        id: verificationId,
        phone,
        code_hash: codeHash,
        expires_at: expiresAt,
        ip_address: ipAddress,
        user_agent: request.headers.get("user-agent"),
      });

    if (insertError) {
      const detail = getErrorMessage(insertError);

      console.error(
        "[PAWU SMS] 인증 요청 DB 저장 실패:",
        insertError,
      );

      return errorResponse(
        "인증 요청을 저장하지 못했습니다.",
        500,
        detail,
      );
    }

    /*
     * 3. Solapi 환경변수 확인
     */
    const apiKey = process.env.SOLAPI_API_KEY?.trim();
    const apiSecret =
      process.env.SOLAPI_API_SECRET?.trim();
    const sender = process.env.SOLAPI_SENDER_NUMBER
      ?.replace(/\D/g, "")
      .trim();

    if (!apiKey || !apiSecret || !sender) {
      await supabaseAdmin
        .from("phone_verification_requests")
        .delete()
        .eq("id", verificationId);

      const missingVariables = [
        !apiKey ? "SOLAPI_API_KEY" : null,
        !apiSecret ? "SOLAPI_API_SECRET" : null,
        !sender ? "SOLAPI_SENDER_NUMBER" : null,
      ].filter(Boolean);

      return errorResponse(
        "Solapi 환경변수가 설정되지 않았습니다.",
        500,
        `누락된 변수: ${missingVariables.join(", ")}`,
      );
    }

    /*
     * 4. Solapi 문자 발송
     */
    const messageService = new SolapiMessageService(
      apiKey,
      apiSecret,
    );

    try {
      await messageService.send({
        to: phone,
        from: sender,
        text: `[PAWU] 휴대폰 인증번호는 ${code}입니다. 3분 이내에 입력해 주세요.`,
      });
    } catch (sendError) {
      await supabaseAdmin
        .from("phone_verification_requests")
        .delete()
        .eq("id", verificationId);

      verificationId = null;

      const detail = getErrorMessage(sendError);

      console.error(
        "[PAWU SMS] Solapi 문자 발송 실패:",
        sendError,
      );

      return errorResponse(
        "인증번호 문자를 발송하지 못했습니다.",
        502,
        detail,
      );
    }

    return NextResponse.json({
      ok: true,
      verificationId,
      maskedPhone: maskPhone(phone),
      expiresInSeconds: 180,
    });
  } catch (error) {
    const detail = getErrorMessage(error);

    console.error(
      "[PAWU SMS] 처리되지 않은 인증번호 발송 오류:",
      error,
    );

    if (verificationId) {
      try {
        await supabaseAdmin
          .from("phone_verification_requests")
          .delete()
          .eq("id", verificationId);
      } catch (cleanupError) {
        console.error(
          "[PAWU SMS] 실패 데이터 정리 오류:",
          cleanupError,
        );
      }
    }

    return errorResponse(
      "인증번호 발송 중 오류가 발생했습니다.",
      500,
      detail,
    );
  }
}