import { NextResponse } from "next/server";
import { SolapiMessageService } from "solapi";
import { supabaseAdmin } from "../../../../../../lib/supabase-admin";
import {
  createOtpCode,
  hashOtp,
} from "../../../../../../lib/auth/otp";
import {
  maskPhone,
  normalizeKoreanPhone,
} from "../../../../../../lib/auth/phone";

export const runtime = "nodejs";

function getClientIp(request: Request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      phone?: string;
    };

    const phone = normalizeKoreanPhone(body.phone ?? "");
    const ipAddress = getClientIp(request);
    const now = new Date();
    const oneMinuteAgo = new Date(now.getTime() - 60_000).toISOString();
    const oneHourAgo = new Date(
      now.getTime() - 60 * 60_000,
    ).toISOString();

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

    if (
      recentPhoneResult.error ||
      hourlyPhoneResult.error ||
      hourlyIpResult.error
    ) {
      throw new Error("인증 요청 제한을 확인하지 못했습니다.");
    }

    if ((recentPhoneResult.count ?? 0) >= 1) {
      return NextResponse.json(
        {
          ok: false,
          message: "인증번호는 1분 후 다시 요청할 수 있습니다.",
        },
        { status: 429 },
      );
    }

    if ((hourlyPhoneResult.count ?? 0) >= 5) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "해당 번호의 인증 요청 횟수를 초과했습니다. 잠시 후 다시 시도해 주세요.",
        },
        { status: 429 },
      );
    }

    if ((hourlyIpResult.count ?? 0) >= 20) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "인증 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.",
        },
        { status: 429 },
      );
    }

    const verificationId = crypto.randomUUID();
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
      throw new Error(insertError.message);
    }

    const apiKey = process.env.SOLAPI_API_KEY;
    const apiSecret = process.env.SOLAPI_API_SECRET;
    const sender = process.env.SOLAPI_SENDER_NUMBER;

    if (!apiKey || !apiSecret || !sender) {
      await supabaseAdmin
        .from("phone_verification_requests")
        .delete()
        .eq("id", verificationId);

      throw new Error("Solapi 환경변수가 설정되지 않았습니다.");
    }

    const messageService = new SolapiMessageService(
      apiKey,
      apiSecret,
    );

    try {
      await messageService.send({
        to: phone,
        from: sender.replace(/\D/g, ""),
        text: `[PAWU] 휴대폰 인증번호는 ${code}입니다. 3분 이내에 입력해 주세요.`,
      });
    } catch (sendError) {
      await supabaseAdmin
        .from("phone_verification_requests")
        .delete()
        .eq("id", verificationId);

      throw sendError;
    }

    return NextResponse.json({
      ok: true,
      verificationId,
      maskedPhone: maskPhone(phone),
      expiresInSeconds: 180,
    });
  } catch (error) {
    console.error("Solapi 인증번호 발송 오류:", error);

    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "인증번호를 발송하지 못했습니다.",
      },
      { status: 400 },
    );
  }
}
