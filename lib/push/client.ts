"use client";

import { getApp, getApps, initializeApp } from "firebase/app";
import {
  deleteToken,
  getMessaging,
  getToken,
  isSupported,
  onMessage,
  type MessagePayload,
  type Messaging,
} from "firebase/messaging";
import { supabase } from "@/lib/supabase";

export type PushStage =
  | "idle"
  | "permission"
  | "config"
  | "service-worker"
  | "firebase"
  | "token"
  | "save"
  | "complete";

export type PushConnectionResult = {
  ok: boolean;
  stage: PushStage;
  code:
    | "connected"
    | "already-connected"
    | "unsupported"
    | "not-authenticated"
    | "permission-required"
    | "permission-denied"
    | "config-missing"
    | "project-mismatch"
    | "service-worker-failed"
    | "firebase-failed"
    | "token-failed"
    | "save-failed"
    | "timeout"
    | "unknown";
  message: string;
  tokenPreview?: string;
};

type FirebaseConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  vapidKey: string;
};

const SW_URL = "/firebase-messaging-sw.js";
const SW_SCOPE = "/";
const TOKEN_TIMEOUT_MS = 25_000;

function guardianPath(pathname: string) {
  return ![
    "/hospital-admin",
    "/auth/hospital",
    "/admin",
    "/super-admin",
    "/platform",
  ].some((prefix) => pathname.startsWith(prefix));
}

async function getAccessToken() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? "";
}

async function getPushConfig(): Promise<FirebaseConfig> {
  const response = await fetch("/api/push/config", {
    cache: "no-store",
  });
  const result = await response.json().catch(() => ({}));

  if (!response.ok || !result.clientReady || !result.serverReady) {
    throw Object.assign(
      new Error(
        `Firebase 설정이 부족합니다: ${[
          ...(result.missingClientEnv ?? []),
          ...(result.missingServerEnv ?? []),
        ].join(", ")}`,
      ),
      { code: "CONFIG_MISSING" },
    );
  }

  if (result.projectMatch === false) {
    throw Object.assign(
      new Error(
        `Firebase 프로젝트가 다릅니다. 앱=${result.clientProjectId || "-"}, 서버=${result.serverProjectId || "-"}`,
      ),
      { code: "PROJECT_MISMATCH" },
    );
  }

  return result.config as FirebaseConfig;
}

async function unregisterLegacyWorkers() {
  const registrations = await navigator.serviceWorker.getRegistrations();

  for (const registration of registrations) {
    const activeUrl =
      registration.active?.scriptURL ||
      registration.waiting?.scriptURL ||
      registration.installing?.scriptURL ||
      "";

    if (
      activeUrl &&
      !activeUrl.endsWith(SW_URL)
    ) {
      await registration.unregister();
    }
  }
}

async function registerMessagingWorker() {
  await unregisterLegacyWorkers();

  const registration = await navigator.serviceWorker.register(
    SW_URL,
    {
      scope: SW_SCOPE,
      updateViaCache: "none",
    },
  );

  await registration.update();

  if (registration.installing) {
    await new Promise<void>((resolve, reject) => {
      const worker = registration.installing;
      if (!worker) {
        resolve();
        return;
      }

      const timeout = window.setTimeout(
        () =>
          reject(
            new Error(
              "서비스 워커 설치 시간이 초과되었습니다.",
            ),
          ),
        15_000,
      );

      const complete = () => {
        if (
          worker.state === "activated" ||
          worker.state === "installed"
        ) {
          window.clearTimeout(timeout);
          resolve();
        }

        if (worker.state === "redundant") {
          window.clearTimeout(timeout);
          reject(
            new Error(
              "서비스 워커 설치가 중단되었습니다.",
            ),
          );
        }
      };

      worker.addEventListener("statechange", complete);
      complete();
    });
  }

  return registration;
}

function initializeMessaging(config: FirebaseConfig): Messaging {
  const firebaseConfig = {
    apiKey: config.apiKey,
    authDomain: config.authDomain,
    projectId: config.projectId,
    storageBucket: config.storageBucket,
    messagingSenderId: config.messagingSenderId,
    appId: config.appId,
  };

  const app = getApps().length
    ? getApp()
    : initializeApp(firebaseConfig);

  return getMessaging(app);
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  message: string,
): Promise<T> {
  return await Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      window.setTimeout(
        () =>
          reject(
            Object.assign(new Error(message), {
              code: "TIMEOUT",
            }),
          ),
        timeoutMs,
      );
    }),
  ]);
}

export async function getPushRegistrationStatus() {
  const accessToken = await getAccessToken();
  if (!accessToken) {
    return {
      registered: false,
      updatedAt: null,
    };
  }

  const response = await fetch("/api/push/register", {
    headers: {
      authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });
  const result = await response.json().catch(() => ({}));

  return {
    registered: Boolean(response.ok && result.registered),
    updatedAt: result.updatedAt ?? null,
  };
}

export async function connectGuardianPush(options?: {
  requestPermission?: boolean;
  resetToken?: boolean;
  onStage?: (stage: PushStage, message: string) => void;
}): Promise<PushConnectionResult> {
  const notifyStage = (
    stage: PushStage,
    message: string,
  ) => options?.onStage?.(stage, message);

  if (
    typeof window === "undefined" ||
    !guardianPath(window.location.pathname)
  ) {
    return {
      ok: false,
      stage: "idle",
      code: "unsupported",
      message:
        "보호자 앱 화면에서만 연결할 수 있습니다.",
    };
  }

  if (
    !("serviceWorker" in navigator) ||
    typeof Notification === "undefined"
  ) {
    return {
      ok: false,
      stage: "idle",
      code: "unsupported",
      message:
        "이 기기에서는 웹 푸시 알림을 지원하지 않습니다.",
    };
  }

  const supported = await isSupported().catch(() => false);
  if (!supported) {
    return {
      ok: false,
      stage: "firebase",
      code: "unsupported",
      message:
        "현재 브라우저 또는 앱에서는 Firebase 푸시를 지원하지 않습니다.",
    };
  }

  const accessToken = await getAccessToken();
  if (!accessToken) {
    return {
      ok: false,
      stage: "idle",
      code: "not-authenticated",
      message: "보호자 로그인이 필요합니다.",
    };
  }

  notifyStage(
    "permission",
    "알림 권한을 확인하고 있습니다.",
  );

  let permission = Notification.permission;

  if (
    permission === "default" &&
    options?.requestPermission
  ) {
    permission = await Notification.requestPermission();
  }

  if (permission === "default") {
    return {
      ok: false,
      stage: "permission",
      code: "permission-required",
      message:
        "알림 권한 허용 버튼을 눌러 연결해 주세요.",
    };
  }

  if (permission !== "granted") {
    return {
      ok: false,
      stage: "permission",
      code: "permission-denied",
      message:
        "휴대폰 설정에서 PAWU 알림 권한을 허용해 주세요.",
    };
  }

  try {
    notifyStage(
      "config",
      "Firebase 설정을 확인하고 있습니다.",
    );
    const config = await getPushConfig();

    notifyStage(
      "service-worker",
      "백그라운드 알림 서비스를 준비하고 있습니다.",
    );
    const registration =
      await registerMessagingWorker();

    notifyStage(
      "firebase",
      "Firebase Messaging을 초기화하고 있습니다.",
    );
    const messaging = initializeMessaging(config);

    if (options?.resetToken) {
      try {
        await withTimeout(
          deleteToken(messaging),
          8_000,
          "기존 토큰 삭제 시간이 초과되었습니다.",
        );
      } catch (error) {
        console.warn(
          "PAWU old FCM token reset skipped:",
          error,
        );
      }
    }

    notifyStage(
      "token",
      "휴대폰 푸시 토큰을 발급하고 있습니다.",
    );
    const token = await withTimeout(
      getToken(messaging, {
        vapidKey: config.vapidKey,
        serviceWorkerRegistration: registration,
      }),
      TOKEN_TIMEOUT_MS,
      "FCM 토큰 발급 시간이 초과되었습니다.",
    );

    if (!token) {
      return {
        ok: false,
        stage: "token",
        code: "token-failed",
        message: "FCM 토큰이 비어 있습니다.",
      };
    }

    notifyStage(
      "save",
      "푸시 토큰을 PAWU 서버에 저장하고 있습니다.",
    );
    const saveResponse = await fetch(
      "/api/push/register",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          token,
          deviceName: navigator.userAgent,
        }),
      },
    );
    const saveResult = await saveResponse
      .json()
      .catch(() => ({}));

    if (!saveResponse.ok) {
      return {
        ok: false,
        stage: "save",
        code: "save-failed",
        message:
          saveResult.message ??
          "푸시 토큰을 저장하지 못했습니다.",
      };
    }

    await fetch("/api/notifications/preferences", {
      method: "PUT",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        browser_push: true,
        chat_messages: true,
      }),
    }).catch(() => undefined);

    notifyStage(
      "complete",
      "푸시 알림 연결이 완료되었습니다.",
    );

    return {
      ok: true,
      stage: "complete",
      code: "connected",
      message: "푸시 알림 연결이 완료되었습니다.",
      tokenPreview: `${token.slice(0, 10)}…${token.slice(-6)}`,
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "푸시 연결 중 알 수 없는 오류가 발생했습니다.";

    const rawCode =
      typeof error === "object" &&
      error &&
      "code" in error
        ? String((error as { code?: unknown }).code)
        : "";

    if (rawCode === "PROJECT_MISMATCH") {
      return {
        ok: false,
        stage: "config",
        code: "project-mismatch",
        message,
      };
    }

    if (rawCode === "CONFIG_MISSING") {
      return {
        ok: false,
        stage: "config",
        code: "config-missing",
        message,
      };
    }

    if (rawCode === "TIMEOUT") {
      return {
        ok: false,
        stage: "token",
        code: "timeout",
        message,
      };
    }

    if (
      message.toLowerCase().includes("service worker") ||
      message.toLowerCase().includes("serviceworker")
    ) {
      return {
        ok: false,
        stage: "service-worker",
        code: "service-worker-failed",
        message,
      };
    }

    if (
      message.toLowerCase().includes("token") ||
      message.toLowerCase().includes("push")
    ) {
      return {
        ok: false,
        stage: "token",
        code: "token-failed",
        message,
      };
    }

    return {
      ok: false,
      stage: "firebase",
      code: "firebase-failed",
      message,
    };
  }
}

export async function disconnectGuardianPush() {
  const accessToken = await getAccessToken();
  if (!accessToken) return;

  await fetch("/api/push/register", {
    method: "DELETE",
    headers: {
      authorization: `Bearer ${accessToken}`,
    },
  });
}

export async function installForegroundPushListener() {
  if (
    typeof window === "undefined" ||
    Notification.permission !== "granted"
  ) {
    return () => undefined;
  }

  try {
    const supported = await isSupported();
    if (!supported) return () => undefined;

    const config = await getPushConfig();
    const messaging = initializeMessaging(config);

    return onMessage(
      messaging,
      (payload: MessagePayload) => {
        const title =
          payload.notification?.title ||
          payload.data?.title ||
          "PAWU 알림";
        const body =
          payload.notification?.body ||
          payload.data?.body ||
          "새 알림이 도착했습니다.";

        window.dispatchEvent(
          new CustomEvent("pawu:push-message", {
            detail: payload,
          }),
        );

        if (document.hidden) {
          new Notification(title, {
            body,
            icon: "/icons/pawu-v903-192.png",
            tag:
              payload.data?.tag || "pawu-message",
          });
        }
      },
    );
  } catch (error) {
    console.warn(
      "PAWU foreground push listener failed:",
      error,
    );
    return () => undefined;
  }
}
