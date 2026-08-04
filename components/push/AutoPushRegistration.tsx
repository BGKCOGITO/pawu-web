"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

declare global {
  interface Window {
    firebase?: {
      apps: unknown[];
      initializeApp: (config: Record<string, string>) => unknown;
      messaging: () => {
        getToken: (options: {
          vapidKey: string;
          serviceWorkerRegistration: ServiceWorkerRegistration;
        }) => Promise<string>;
        deleteToken?: (token: string) => Promise<boolean>;
      };
    };
  }
}

type RegisterResult =
  | { ok: true }
  | { ok: false; reason: string };

const REGISTER_LOCK_KEY = "pawu_push_register_lock";
const REGISTER_LOCK_MS = 15_000;

function isGuardianPage() {
  const path = window.location.pathname;

  return !(
    path.startsWith("/hospital-admin") ||
    path.startsWith("/auth/hospital") ||
    path.startsWith("/admin") ||
    path.startsWith("/super-admin") ||
    path.startsWith("/platform")
  );
}

function ensureScript(src: string) {
  const existing = document.querySelector(
    `script[src="${src}"]`,
  );

  if (existing) return;

  const script = document.createElement("script");
  script.src = src;
  script.async = true;
  document.head.appendChild(script);
}

async function waitForFirebase(timeoutMs = 10_000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (window.firebase?.messaging) return;
    await new Promise((resolve) => window.setTimeout(resolve, 100));
  }

  throw new Error("Firebase SDK를 불러오지 못했습니다.");
}

async function getAccessToken() {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  return session?.access_token ?? "";
}

async function registerGuardianPush(
  forceRefresh = false,
): Promise<RegisterResult> {
  if (
    typeof window === "undefined" ||
    typeof Notification === "undefined" ||
    !("serviceWorker" in navigator)
  ) {
    return {
      ok: false,
      reason: "이 기기에서는 푸시 알림을 지원하지 않습니다.",
    };
  }

  if (!isGuardianPage()) {
    return {
      ok: false,
      reason: "병원 관리자 화면에서는 등록하지 않습니다.",
    };
  }

  const accessToken = await getAccessToken();

  if (!accessToken) {
    return {
      ok: false,
      reason: "보호자 로그인이 필요합니다.",
    };
  }

  if (Notification.permission !== "granted") {
    return {
      ok: false,
      reason: "알림 권한을 먼저 허용해 주세요.",
    };
  }

  const previousLock = Number(
    window.localStorage.getItem(REGISTER_LOCK_KEY) ?? "0",
  );

  if (
    !forceRefresh &&
    Number.isFinite(previousLock) &&
    Date.now() - previousLock < REGISTER_LOCK_MS
  ) {
    return {
      ok: false,
      reason: "푸시 연결을 확인 중입니다.",
    };
  }

  window.localStorage.setItem(
    REGISTER_LOCK_KEY,
    String(Date.now()),
  );

  try {
    const [configResponse, registrationStatusResponse] =
      await Promise.all([
        fetch("/api/push/config", {
          cache: "no-store",
        }),
        fetch("/api/push/register", {
          headers: {
            authorization: `Bearer ${accessToken}`,
          },
          cache: "no-store",
        }),
      ]);

    const configResult = await configResponse
      .json()
      .catch(() => ({}));
    const registrationStatus =
      await registrationStatusResponse
        .json()
        .catch(() => ({}));

    if (!configResponse.ok || !configResult.clientReady) {
      return {
        ok: false,
        reason: `Firebase 웹 설정이 부족합니다: ${(
          configResult.missingClientEnv ?? []
        ).join(", ")}`,
      };
    }

    if (!configResult.serverReady) {
      return {
        ok: false,
        reason:
          "Firebase 서버 설정이 완료되지 않았습니다.",
      };
    }

    if (configResult.projectMatch === false) {
      return {
        ok: false,
        reason:
          "Firebase 앱 설정과 서버 서비스 계정의 프로젝트가 다릅니다.",
      };
    }

    ensureScript(
      "https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js",
    );
    ensureScript(
      "https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js",
    );

    await waitForFirebase();

    if (!window.firebase) {
      return {
        ok: false,
        reason: "Firebase SDK 초기화에 실패했습니다.",
      };
    }

    if (!window.firebase.apps.length) {
      window.firebase.initializeApp(configResult.config);
    }

    const serviceWorkerRegistration =
      await navigator.serviceWorker.register(
        "/firebase-messaging-sw.js",
        { scope: "/" },
      );

    await navigator.serviceWorker.ready;

    const messaging = window.firebase.messaging();
    let fcmToken = await messaging.getToken({
      vapidKey: configResult.config.vapidKey,
      serviceWorkerRegistration,
    });

    const needsFreshToken =
      forceRefresh ||
      !registrationStatusResponse.ok ||
      !registrationStatus.registered;

    if (
      needsFreshToken &&
      fcmToken &&
      messaging.deleteToken
    ) {
      try {
        await messaging.deleteToken(fcmToken);
      } catch (deleteError) {
        console.warn(
          "PAWU previous FCM token delete failed:",
          deleteError,
        );
      }

      fcmToken = await messaging.getToken({
        vapidKey: configResult.config.vapidKey,
        serviceWorkerRegistration,
      });
    }

    if (!fcmToken) {
      return {
        ok: false,
        reason: "휴대폰 푸시 토큰을 발급하지 못했습니다.",
      };
    }

    const saveResponse = await fetch("/api/push/register", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        token: fcmToken,
        deviceName: navigator.userAgent,
      }),
    });

    const saveResult = await saveResponse
      .json()
      .catch(() => ({}));

    if (!saveResponse.ok) {
      return {
        ok: false,
        reason:
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
    });

    window.localStorage.removeItem(REGISTER_LOCK_KEY);
    return { ok: true };
  } catch (error) {
    window.localStorage.removeItem(REGISTER_LOCK_KEY);

    return {
      ok: false,
      reason:
        error instanceof Error
          ? error.message
          : "푸시 알림 연결에 실패했습니다.",
    };
  }
}

export default function AutoPushRegistration() {
  const [visible, setVisible] = useState(false);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");

  const checkAndRegister = useCallback(async () => {
    if (
      typeof window === "undefined" ||
      !isGuardianPage()
    ) {
      setVisible(false);
      return;
    }

    const accessToken = await getAccessToken();

    if (!accessToken) {
      setVisible(false);
      return;
    }

    if (typeof Notification === "undefined") {
      setMessage(
        "이 기기에서는 푸시 알림을 지원하지 않습니다.",
      );
      setVisible(true);
      return;
    }

    if (Notification.permission === "denied") {
      setMessage(
        "휴대폰 설정에서 PAWU 알림 권한을 허용해 주세요.",
      );
      setVisible(true);
      return;
    }

    if (Notification.permission === "default") {
      // 브라우저 정책상 권한 요청은 사용자의 버튼 클릭이 필요합니다.
      setMessage(
        "앱을 닫아도 병원 채팅 알림을 받으려면 알림 권한을 허용해 주세요.",
      );
      setVisible(true);
      return;
    }

    const result = await registerGuardianPush();

    if (result.ok) {
      setVisible(false);
      setMessage("");
      return;
    }

    if (result.reason !== "푸시 연결을 확인 중입니다.") {
      setMessage(result.reason);
      setVisible(true);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void checkAndRegister();
    }, 1000);

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (
        event === "SIGNED_IN" ||
        event === "TOKEN_REFRESHED"
      ) {
        window.setTimeout(() => {
          void checkAndRegister();
        }, 700);
      }

      if (event === "SIGNED_OUT") {
        setVisible(false);
      }
    });

    const onVisible = () => {
      if (document.visibilityState === "visible") {
        void checkAndRegister();
      }
    };

    document.addEventListener(
      "visibilitychange",
      onVisible,
    );
    window.addEventListener("focus", onVisible);

    return () => {
      window.clearTimeout(timer);
      subscription.unsubscribe();
      document.removeEventListener(
        "visibilitychange",
        onVisible,
      );
      window.removeEventListener("focus", onVisible);
    };
  }, [checkAndRegister]);

  async function enablePush() {
    setWorking(true);
    setMessage("");

    try {
      if (
        typeof Notification === "undefined" ||
        !("serviceWorker" in navigator)
      ) {
        setMessage(
          "이 기기에서는 푸시 알림을 지원하지 않습니다.",
        );
        return;
      }

      const permission =
        await Notification.requestPermission();

      if (permission !== "granted") {
        setMessage(
          "알림이 차단되었습니다. 휴대폰 설정에서 PAWU 알림을 허용해 주세요.",
        );
        setVisible(true);
        return;
      }

      const result = await registerGuardianPush(true);

      if (!result.ok) {
        setMessage(result.reason);
        setVisible(true);
        return;
      }

      setMessage("푸시 알림 연결이 완료되었습니다.");
      window.setTimeout(() => {
        setVisible(false);
        setMessage("");
      }, 1500);
    } finally {
      setWorking(false);
    }
  }

  if (!visible) return null;

  return (
    <div className="fixed inset-x-4 bottom-24 z-[120] mx-auto max-w-md rounded-3xl border border-[#b9d8cf] bg-white p-5 shadow-2xl md:bottom-6">
      <p className="text-xs font-black tracking-[0.16em] text-[#d86c57]">
        PAWU NOTIFICATION
      </p>
      <h2 className="mt-1 text-lg font-black text-[#153f34]">
        보호자 알림 연결
      </h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        {message}
      </p>

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          disabled={working}
          onClick={() => void enablePush()}
          className="flex-1 rounded-2xl bg-[#153f34] px-4 py-3 text-sm font-bold text-white disabled:opacity-50"
        >
          {working ? "연결 중..." : "알림 허용 및 연결"}
        </button>

        <button
          type="button"
          disabled={working}
          onClick={() => setVisible(false)}
          className="rounded-2xl border border-slate-300 px-4 py-3 text-sm font-bold text-slate-600"
        >
          나중에
        </button>
      </div>
    </div>
  );
}
