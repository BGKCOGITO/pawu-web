"use client";

import { useEffect } from "react";
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

const REGISTER_LOCK_KEY = "pawu_push_register_lock";
const REGISTER_LOCK_MS = 60_000;

function loadScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    const existing = document.querySelector(
      `script[src="${src}"]`,
    ) as HTMLScriptElement | null;

    if (existing) {
      if (existing.dataset.loaded === "true") {
        resolve();
        return;
      }

      existing.addEventListener("load", () => resolve(), {
        once: true,
      });
      existing.addEventListener(
        "error",
        () =>
          reject(
            new Error("Firebase SDK를 불러오지 못했습니다."),
          ),
        { once: true },
      );
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.addEventListener(
      "load",
      () => {
        script.dataset.loaded = "true";
        resolve();
      },
      { once: true },
    );
    script.addEventListener(
      "error",
      () =>
        reject(
          new Error("Firebase SDK를 불러오지 못했습니다."),
        ),
      { once: true },
    );
    document.head.appendChild(script);
  });
}

async function getAccessToken() {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  return session?.access_token ?? "";
}

async function registerGuardianPush() {
  if (
    typeof window === "undefined" ||
    typeof Notification === "undefined" ||
    !("serviceWorker" in navigator)
  ) {
    return;
  }

  // 병원 프로그램에서는 보호자 푸시 토큰을 등록하지 않습니다.
  if (
    window.location.pathname.startsWith("/hospital-admin") ||
    window.location.pathname.startsWith("/auth/hospital")
  ) {
    return;
  }

  const accessToken = await getAccessToken();
  if (!accessToken) return;

  if (Notification.permission !== "granted") {
    return;
  }

  const previousLock = Number(
    window.localStorage.getItem(REGISTER_LOCK_KEY) ?? "0",
  );

  if (
    Number.isFinite(previousLock) &&
    Date.now() - previousLock < REGISTER_LOCK_MS
  ) {
    return;
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
        loadScript(
          "https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js",
        ),
        loadScript(
          "https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js",
        ),
      ]);

    const configResult = await configResponse
      .json()
      .catch(() => ({}));
    const registrationStatus =
      await registrationStatusResponse
        .json()
        .catch(() => ({}));

    if (!configResponse.ok || !configResult.clientReady) {
      console.error(
        "PAWU push config is incomplete:",
        configResult.missingClientEnv ?? [],
      );
      return;
    }

    if (!configResult.serverReady) {
      console.error(
        "PAWU Firebase service account is not configured.",
      );
      return;
    }

    if (configResult.projectMatch === false) {
      console.error(
        "PAWU Firebase project mismatch:",
        configResult.clientProjectId,
        configResult.serverProjectId,
      );
      return;
    }

    if (!window.firebase) {
      console.error("PAWU Firebase SDK initialization failed.");
      return;
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

    // DB에 활성 토큰이 없는데 브라우저 캐시에 오래된 토큰만 남아 있으면
    // Firebase 토큰을 폐기한 뒤 새 토큰을 강제로 발급합니다.
    if (
      !registrationStatusResponse.ok ||
      !registrationStatus.registered
    ) {
      if (fcmToken && messaging.deleteToken) {
        try {
          await messaging.deleteToken(fcmToken);
        } catch (deleteError) {
          console.warn(
            "PAWU stale FCM token delete failed:",
            deleteError,
          );
        }

        fcmToken = await messaging.getToken({
          vapidKey: configResult.config.vapidKey,
          serviceWorkerRegistration,
        });
      }
    }

    if (!fcmToken) {
      console.error("PAWU FCM token was not issued.");
      return;
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
      console.error(
        "PAWU push token registration failed:",
        saveResult.message ?? saveResponse.status,
      );
      return;
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
  } catch (error) {
    console.error("PAWU automatic push registration failed:", error);
    window.localStorage.removeItem(REGISTER_LOCK_KEY);
  }
}

export default function AutoPushRegistration() {
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void registerGuardianPush();
    }, 1200);

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        window.setTimeout(() => {
          void registerGuardianPush();
        }, 800);
      }
    });

    const onVisible = () => {
      if (document.visibilityState === "visible") {
        void registerGuardianPush();
      }
    };

    document.addEventListener("visibilitychange", onVisible);
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
  }, []);

  return null;
}
