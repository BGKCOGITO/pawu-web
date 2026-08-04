import { createSign } from "node:crypto";
import { supabaseAdmin } from "../supabase-admin";

type ServiceAccount = {
  client_email: string;
  private_key: string;
  project_id: string;
};

type PushPayload = {
  title: string;
  body: string;
  url: string;
  tag?: string;
};

function base64url(value: string | Buffer) {
  return Buffer.from(value).toString("base64url");
}

function parseServiceAccount(rawValue: string): ServiceAccount | null {
  const trimmed = rawValue.trim();
  const candidates = [trimmed];

  // Vercel이나 PowerShell에서 JSON 전체가 따옴표로 한 번 더 감싸진 경우를 허용한다.
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    candidates.push(trimmed.slice(1, -1));
  }

  // 향후 필요 시 FIREBASE_SERVICE_ACCOUNT_JSON에 base64 JSON을 넣어도 동작하도록 허용한다.
  try {
    candidates.push(Buffer.from(trimmed, "base64").toString("utf8"));
  } catch {
    // 일반 JSON이면 base64 변환 실패를 무시한다.
  }

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as Partial<ServiceAccount>;
      if (!parsed.client_email || !parsed.private_key || !parsed.project_id) continue;
      return {
        client_email: parsed.client_email,
        project_id: parsed.project_id,
        // 환경변수 입력 과정에서 실제 줄바꿈이 \\n 문자열로 보존된 경우를 복원한다.
        private_key: parsed.private_key.replace(/\\n/g, "\n"),
      };
    } catch {
      // 다음 후보를 확인한다.
    }
  }

  return null;
}

export function isFirebaseAdminConfigured() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  return Boolean(raw && parseServiceAccount(raw));
}

export function getFirebaseAdminProjectId() {
  return readServiceAccount()?.project_id ?? "";
}

function readServiceAccount(): ServiceAccount | null {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;
  return parseServiceAccount(raw);
}

async function getAccessToken(account: ServiceAccount) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = base64url(JSON.stringify({
    iss: account.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  }));
  const unsigned = `${header}.${claim}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  signer.end();
  const assertion = `${unsigned}.${signer.sign(account.private_key, "base64url")}`;

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
    cache: "no-store",
  });

  // 일부 환경에서 위 grant_type 오타가 있을 경우를 조기에 발견할 수 있도록 명확한 오류를 남긴다.
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Firebase OAuth failed: ${response.status} ${detail.slice(0, 300)}`);
  }
  const result = (await response.json()) as { access_token?: string };
  if (!result.access_token) throw new Error("Firebase OAuth token missing");
  return result.access_token;
}

export async function sendGuardianChatPush(userId: string, payload: PushPayload) {
  const account = readServiceAccount();
  if (!account) return { sent: 0, skipped: true, reason: "firebase-admin-not-configured" };

  const { data: rows, error } = await supabaseAdmin
    .from("fcm_tokens")
    .select("id,token")
    .eq("user_id", userId)
    .eq("is_active", true);
  if (error) throw new Error(`FCM token lookup failed: ${error.message}`);
  if (!rows?.length) return { sent: 0, skipped: true, reason: "no-active-token" };

  const accessToken = await getAccessToken(account);
  let sent = 0;
  for (const row of rows) {
    const response = await fetch(`https://fcm.googleapis.com/v1/projects/${account.project_id}/messages:send`, {
      method: "POST",
      headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
      body: JSON.stringify({
        message: {
          token: row.token,
          // 데이터 전용 메시지로 전송해 Service Worker가 알림을 한 번만 표시한다.
          data: {
            title: payload.title,
            body: payload.body,
            url: payload.url,
            tag: payload.tag ?? "pawu-chat-message",
          },
          webpush: {
            headers: {
              Urgency: "high",
              TTL: "86400",
            },
          },
        },
      }),
      cache: "no-store",
    });

    if (response.ok) {
      sent += 1;
      continue;
    }

    const detail = await response.text();
    console.error(
      "PAWU FCM send failed",
      response.status,
      detail.slice(0, 1000),
    );

    const tokenIsInvalid =
      detail.includes("UNREGISTERED") ||
      detail.includes('"errorCode":"UNREGISTERED"') ||
      detail.includes("registration-token-not-registered");

    if (tokenIsInvalid) {
      await supabaseAdmin
        .from("fcm_tokens")
        .update({
          is_active: false,
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id);
    }
  }
  return { sent, skipped: false };
}
