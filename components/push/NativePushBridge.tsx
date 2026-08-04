"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

const NATIVE_MARKER_KEY = "pawu_native_push_android";
const NATIVE_TOKEN_KEY = "pawu_native_fcm_token_pending";
const NATIVE_SYNCED_TOKEN_KEY = "pawu_native_fcm_token_synced";

export function isNativeAndroidPushApp() {
  if (typeof window === "undefined") return false;

  const params = new URLSearchParams(window.location.search);
  return (
    params.get("pawu_native") === "android" ||
    window.localStorage.getItem(NATIVE_MARKER_KEY) === "1"
  );
}

async function registerNativeToken(token: string) {
  const { data } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token;
  if (!accessToken) return false;

  const response = await fetch("/api/push/register", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      token,
      deviceName: "PAWU Android Native",
    }),
  });

  if (!response.ok) {
    const result = await response.json().catch(() => ({}));
    console.error(
      "PAWU native FCM token registration failed:",
      result.message ?? response.status,
    );
    return false;
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

  return true;
}

export default function NativePushBridge() {
  const router = useRouter();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const platform = params.get("pawu_native");
    const incomingToken = params.get("pawu_native_fcm_token");

    if (platform === "android") {
      window.localStorage.setItem(NATIVE_MARKER_KEY, "1");
    }

    if (incomingToken) {
      window.localStorage.setItem(
        NATIVE_TOKEN_KEY,
        incomingToken,
      );
    }

    async function syncToken() {
      const token =
        incomingToken ||
        window.localStorage.getItem(NATIVE_TOKEN_KEY);

      if (!token) return;

      const saved = await registerNativeToken(token);
      if (!saved) return;

      window.localStorage.setItem(
        NATIVE_SYNCED_TOKEN_KEY,
        token,
      );
      window.localStorage.removeItem(NATIVE_TOKEN_KEY);

      window.dispatchEvent(
        new CustomEvent("pawu:native-push-registered"),
      );

      const url = new URL(window.location.href);
      url.searchParams.delete("pawu_native");
      url.searchParams.delete("pawu_native_fcm_token");
      router.replace(
        `${url.pathname}${url.search}${url.hash}`,
      );
    }

    void syncToken();

    const retryTimer = window.setInterval(() => {
      void syncToken();
    }, 10_000);

    const syncWhenVisible = () => {
      if (document.visibilityState === "visible") {
        void syncToken();
      }
    };

    window.addEventListener("focus", syncWhenVisible);
    document.addEventListener(
      "visibilitychange",
      syncWhenVisible,
    );

    const { data: listener } =
      supabase.auth.onAuthStateChange((event) => {
        if (
          event === "SIGNED_IN" ||
          event === "TOKEN_REFRESHED"
        ) {
          window.setTimeout(() => void syncToken(), 500);
        }
      });

    return () => {
      window.clearInterval(retryTimer);
      window.removeEventListener(
        "focus",
        syncWhenVisible,
      );
      document.removeEventListener(
        "visibilitychange",
        syncWhenVisible,
      );
      listener.subscription.unsubscribe();
    };
  }, [router]);

  return null;
}
