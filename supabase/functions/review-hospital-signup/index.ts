import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import {
  hmacSha256Hex,
  randomHex,
} from "../_shared/crypto.ts";

type ReviewAction = "approve" | "reject";

async function sendSolapiMessage(
  phone: string,
  text: string,
) {
  const apiKey = Deno.env.get("SOLAPI_API_KEY");
  const apiSecret = Deno.env.get("SOLAPI_API_SECRET");
  const sender = Deno.env.get("SOLAPI_SENDER");

  if (!apiKey || !apiSecret || !sender) {
    throw new Error("SOLAPI Secret이 등록되지 않았습니다.");
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

  const response = await fetch(
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
            to: phone.replace(/\D/g, ""),
            from: sender.replace(/\D/g, ""),
            text,
            country: "82",
            autoTypeDetect: true,
          },
        ],
        strict: true,
        showMessageList: true,
      }),
    },
  );

  const result = await response.json();

  if (!response.ok) {
    console.error("SOLAPI 발송 오류:", result);
    throw new Error(
      result?.errorMessage
      ?? result?.message
      ?? result?.failedMessageList?.[0]?.statusMessage
      ?? "문자 발송에 실패했습니다.",
    );
  }

  const failedCount =
    result?.groupInfo?.count?.registeredFailed ?? 0;

  if (failedCount > 0) {
    console.error("SOLAPI 문자 접수 실패:", result);
    throw new Error(
      result?.failedMessageList?.[0]?.statusMessage
      ?? "문자 접수에 실패했습니다.",
    );
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse(
      { message: "POST 요청만 허용됩니다." },
      405,
    );
  }

  try {
    const authorization = req.headers.get("Authorization");

    if (!authorization?.startsWith("Bearer ")) {
      return jsonResponse(
        { message: "로그인이 필요합니다." },
        401,
      );
    }

    const accessToken = authorization.slice("Bearer ".length);
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey =
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return jsonResponse(
        { message: "서버 설정이 완료되지 않았습니다." },
        500,
      );
    }

    const userClient = createClient(
      supabaseUrl,
      anonKey,
      {
        global: {
          headers: {
            Authorization: authorization,
          },
        },
        auth: {
          persistSession: false,
        },
      },
    );

    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser(accessToken);

    if (userError || !user) {
      return jsonResponse(
        { message: "유효하지 않은 로그인입니다." },
        401,
      );
    }

    const adminClient = createClient(
      supabaseUrl,
      serviceRoleKey,
      {
        auth: {
          persistSession: false,
        },
      },
    );

    const { data: superAdmin } = await adminClient
      .from("super_admins")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!superAdmin) {
      return jsonResponse(
        { message: "최고관리자 권한이 없습니다." },
        403,
      );
    }

    const body = await req.json();
    const requestId = Number(body.requestId);
    const action = String(body.action ?? "") as ReviewAction;
    const reason = String(body.reason ?? "").trim();

    if (
      !Number.isSafeInteger(requestId) ||
      !["approve", "reject"].includes(action)
    ) {
      return jsonResponse(
        { message: "승인 요청 정보가 올바르지 않습니다." },
        400,
      );
    }

    if (action === "reject" && !reason) {
      return jsonResponse(
        { message: "반려 사유를 입력해 주세요." },
        400,
      );
    }

    const { data: signupRequest, error: requestError } =
      await adminClient
        .from("hospital_signup_requests")
        .select(
          "id, hospital_name, manager_phone, status",
        )
        .eq("id", requestId)
        .maybeSingle();

    if (requestError || !signupRequest) {
      return jsonResponse(
        { message: "병원 가입 신청을 찾지 못했습니다." },
        404,
      );
    }

    if (signupRequest.status !== "pending") {
      return jsonResponse(
        { message: "이미 처리된 신청입니다." },
        409,
      );
    }

    /*
     * RPC 안에서 auth.uid()가 최고관리자 ID로 확인되도록
     * 사용자 세션을 가진 클라이언트로 호출합니다.
     */
    if (action === "approve") {
      const { data: hospitalId, error: approveError } =
        await userClient.rpc(
          "approve_hospital_signup_request",
          { request_id: requestId },
        );

      if (approveError) {
        console.error("병원 승인 처리 실패:", approveError);
        return jsonResponse(
          { message: approveError.message },
          400,
        );
      }

      let smsSent = true;
      let smsWarning: string | null = null;

      try {
        await sendSolapiMessage(
          signupRequest.manager_phone,
          `[PAWU] ${signupRequest.hospital_name} 가입 승인이 완료되었습니다. 병원 관리자 계정으로 로그인해 주세요.`,
        );
      } catch (smsError) {
        smsSent = false;
        smsWarning =
          smsError instanceof Error
            ? smsError.message
            : "승인 문자를 발송하지 못했습니다.";
        console.error("승인 문자 발송 실패:", smsError);
      }

      return jsonResponse({
        ok: true,
        status: "approved",
        hospitalId,
        smsSent,
        smsWarning,
        message: smsSent
          ? "병원 가입을 승인하고 문자를 발송했습니다."
          : "병원 가입은 승인됐지만 문자를 발송하지 못했습니다.",
      });
    }

    const { error: rejectError } = await userClient.rpc(
      "reject_hospital_signup_request",
      {
        request_id: requestId,
        reason,
      },
    );

    if (rejectError) {
      console.error("병원 반려 처리 실패:", rejectError);
      return jsonResponse(
        { message: rejectError.message },
        400,
      );
    }

    let smsSent = true;
    let smsWarning: string | null = null;

    try {
      await sendSolapiMessage(
        signupRequest.manager_phone,
        `[PAWU] ${signupRequest.hospital_name} 가입 신청이 반려되었습니다. 사유: ${reason}`,
      );
    } catch (smsError) {
      smsSent = false;
      smsWarning =
        smsError instanceof Error
          ? smsError.message
          : "반려 문자를 발송하지 못했습니다.";
      console.error("반려 문자 발송 실패:", smsError);
    }

    return jsonResponse({
      ok: true,
      status: "rejected",
      smsSent,
      smsWarning,
      message: smsSent
        ? "병원 가입을 반려하고 문자를 발송했습니다."
        : "병원 가입은 반려됐지만 문자를 발송하지 못했습니다.",
    });
  } catch (error) {
    console.error("review-hospital-signup 오류:", error);

    return jsonResponse(
      {
        message:
          error instanceof Error
            ? error.message
            : "병원 가입 심사 중 오류가 발생했습니다.",
      },
      500,
    );
  }
});