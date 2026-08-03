import { createClient } from "npm:@supabase/supabase-js@2";

type ServiceAccount = {
  client_email: string;
  private_key: string;
  project_id: string;
};

type PushJob = {
  id: string;
  user_id: string;
  payload: Record<string, unknown>;
};

const corsHeaders = {
  "content-type": "application/json; charset=utf-8",
};

function base64Url(input: Uint8Array | string) {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : input;
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function readServiceAccount(): ServiceAccount {
  const raw = Deno.env.get("FIREBASE_SERVICE_ACCOUNT_JSON")?.trim();
  if (!raw) throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is missing");
  const parsed = JSON.parse(raw) as ServiceAccount;
  if (!parsed.client_email || !parsed.private_key || !parsed.project_id) {
    throw new Error("Firebase service account JSON is invalid");
  }
  return { ...parsed, private_key: parsed.private_key.replace(/\\n/g, "\n") };
}

function pemToArrayBuffer(pem: string) {
  const base64 = pem
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\s/g, "");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

async function getAccessToken(account: ServiceAccount) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64Url(JSON.stringify({
    iss: account.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  }));
  const unsigned = `${header}.${claims}`;
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(account.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(unsigned),
  );
  const assertion = `${unsigned}.${base64Url(new Uint8Array(signature))}`;

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  const result = await response.json();
  if (!response.ok || !result.access_token) {
    throw new Error(`Firebase OAuth failed: ${response.status} ${JSON.stringify(result).slice(0, 500)}`);
  }
  return String(result.access_token);
}

function authorized(request: Request) {
  const secret = Deno.env.get("PUSH_WORKER_SECRET");
  const supplied = request.headers.get("x-pawu-push-secret");
  const auth = request.headers.get("authorization");
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  return Boolean(
    (secret && supplied && supplied === secret) ||
    (serviceRole && auth === `Bearer ${serviceRole}`),
  );
}

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ ok: false, message: "POST only" }), { status: 405, headers: corsHeaders });
  }
  if (!authorized(request)) {
    return new Response(JSON.stringify({ ok: false, message: "Unauthorized" }), { status: 401, headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRole) throw new Error("Supabase function environment is incomplete");

  const supabase = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const body = await request.json().catch(() => ({}));
  const jobId = body?.record?.id ?? body?.job_id ?? null;
  const { data: jobs, error: claimError } = await supabase.rpc("claim_push_jobs", {
    p_job_id: jobId,
    p_limit: jobId ? 1 : 20,
  });
  if (claimError) throw new Error(`Job claim failed: ${claimError.message}`);
  if (!jobs?.length) {
    return new Response(JSON.stringify({ ok: true, processed: 0 }), { headers: corsHeaders });
  }

  const account = readServiceAccount();
  const accessToken = await getAccessToken(account);
  let sentJobs = 0;

  for (const job of jobs as PushJob[]) {
    try {
      const { data: tokens, error: tokenError } = await supabase
        .from("fcm_tokens")
        .select("id,token")
        .eq("user_id", job.user_id)
        .eq("is_active", true);
      if (tokenError) throw new Error(`Token lookup failed: ${tokenError.message}`);

      if (!tokens?.length) {
        await supabase.rpc("finish_push_job", {
          p_job_id: job.id,
          p_status: "skipped",
          p_error: "no-active-token",
        });
        continue;
      }

      const payload = job.payload ?? {};
      let successes = 0;
      const transientErrors: string[] = [];

      for (const tokenRow of tokens) {
        const response = await fetch(
          `https://fcm.googleapis.com/v1/projects/${account.project_id}/messages:send`,
          {
            method: "POST",
            headers: {
              authorization: `Bearer ${accessToken}`,
              "content-type": "application/json",
            },
            body: JSON.stringify({
              message: {
                token: tokenRow.token,
                notification: {
                  title: String(payload.title ?? "PAWU 새 병원 메시지"),
                  body: String(payload.body ?? "병원에서 새 메시지가 도착했습니다."),
                },
                data: {
                  url: String(payload.url ?? "/chat"),
                  tag: String(payload.tag ?? "pawu-chat-message"),
                  conversation_id: String(payload.conversation_id ?? ""),
                },
                webpush: {
                  headers: { Urgency: "high", TTL: "86400" },
                  notification: {
                    icon: "/icons/pawu-v903-192.png",
                    badge: "/icons/pawu-v903-192.png",
                    tag: String(payload.tag ?? "pawu-chat-message"),
                    renotify: true,
                    vibrate: [250, 100, 250],
                    data: { url: String(payload.url ?? "/chat") },
                  },
                  fcm_options: {
                    link: new URL(String(payload.url ?? "/chat"), Deno.env.get("PAWU_PUBLIC_URL") ?? "https://pawu-web.vercel.app").href,
                  },
                },
              },
            }),
          },
        );

        if (response.ok) {
          successes += 1;
          continue;
        }

        const detail = await response.text();
        if (
          response.status === 404 ||
          detail.includes("UNREGISTERED") ||
          detail.includes("INVALID_ARGUMENT")
        ) {
          await supabase
            .from("fcm_tokens")
            .update({ is_active: false, updated_at: new Date().toISOString() })
            .eq("id", tokenRow.id);
        } else {
          transientErrors.push(`${response.status}:${detail.slice(0, 300)}`);
        }
      }

      if (successes > 0) {
        await supabase.rpc("finish_push_job", {
          p_job_id: job.id,
          p_status: "sent",
          p_error: null,
        });
        sentJobs += 1;
      } else if (transientErrors.length === 0) {
        await supabase.rpc("finish_push_job", {
          p_job_id: job.id,
          p_status: "skipped",
          p_error: "all-tokens-invalid",
        });
      } else {
        await supabase.rpc("finish_push_job", {
          p_job_id: job.id,
          p_status: "retry",
          p_error: transientErrors.join(" | "),
        });
      }
    } catch (error) {
      await supabase.rpc("finish_push_job", {
        p_job_id: job.id,
        p_status: "retry",
        p_error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return new Response(
    JSON.stringify({ ok: true, processed: jobs.length, sent: sentJobs }),
    { headers: corsHeaders },
  );
});
