"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

declare global {
  interface Window {
    firebase?: {
      apps: unknown[];
      initializeApp: (config: Record<string, string>) => unknown;
      messaging: () => {
        getToken: (options: { vapidKey: string; serviceWorkerRegistration: ServiceWorkerRegistration }) => Promise<string>;
        deleteToken?: (token: string) => Promise<boolean>;
      };
    };
  }
}

const labels: Array<[string, string, string]> = [
  ["reservation_updates", "예약 알림", "예약 승인, 변경, 취소 상태를 받습니다."],
  ["chat_messages", "채팅 알림", "병원이나 보호자의 새 메시지를 받습니다."],
  ["medical_updates", "진료기록 알림", "진료 완료와 건강수첩 갱신을 받습니다."],
  ["medication_reminders", "복약 알림", "등록된 약 복용 시간을 안내합니다."],
  ["vaccination_reminders", "예방접종 알림", "예정된 예방접종 시기를 안내합니다."],
  ["marketing", "마케팅 알림", "PAWU 이벤트와 혜택을 받습니다."],
];

function loadScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`) as HTMLScriptElement | null;
    if (existing) {
      if (existing.dataset.loaded === "true") resolve();
      else existing.addEventListener("load", () => resolve(), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.addEventListener("load", () => { script.dataset.loaded = "true"; resolve(); }, { once: true });
    script.addEventListener("error", () => reject(new Error("Firebase SDK를 불러오지 못했습니다.")), { once: true });
    document.head.appendChild(script);
  });
}

export default function NotificationSettingsPage() {
  const [prefs, setPrefs] = useState<Record<string, boolean>>({});
  const [message, setMessage] = useState("");
  const [working, setWorking] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");

  async function getToken() {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? "";
  }

  useEffect(() => {
    setPermission(typeof Notification === "undefined" ? "unsupported" : Notification.permission);
    async function load() {
      const token = await getToken();
      if (!token) return;
      const response = await fetch("/api/notifications/preferences", { headers: { authorization: `Bearer ${token}` } });
      const result = await response.json();
      setPrefs(result.preferences ?? {});
    }
    void load();
  }, []);

  async function enableBrowserNotification() {
    setWorking(true);
    setMessage("");
    try {
      if (typeof Notification === "undefined" || !("serviceWorker" in navigator)) {
        throw new Error("이 기기에서는 푸시 알림을 지원하지 않습니다.");
      }

      const next = await Notification.requestPermission();
      setPermission(next);
      if (next !== "granted") throw new Error("휴대폰 설정에서 PAWU 알림 권한을 허용해 주세요.");

      const [configResponse] = await Promise.all([
        fetch("/api/push/config", { cache: "no-store" }),
        loadScript("https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js"),
        loadScript("https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js"),
      ]);
      const configResult = await configResponse.json();
      if (!configResult.clientReady) {
        throw new Error(`Firebase 웹 설정이 부족합니다: ${(configResult.missingClientEnv ?? []).join(", ")}`);
      }
      if (!configResult.serverReady) {
        throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON이 아직 설정되지 않았습니다.");
      }
      if (!window.firebase) throw new Error("Firebase SDK 초기화에 실패했습니다.");

      if (!window.firebase.apps.length) window.firebase.initializeApp(configResult.config);
      const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js", { scope: "/" });
      await navigator.serviceWorker.ready;
      const fcmToken = await window.firebase.messaging().getToken({
        vapidKey: configResult.config.vapidKey,
        serviceWorkerRegistration: registration,
      });
      if (!fcmToken) throw new Error("휴대폰 푸시 토큰을 발급하지 못했습니다.");

      const authToken = await getToken();
      const saveResponse = await fetch("/api/push/register", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ token: fcmToken, deviceName: navigator.userAgent }),
      });
      const saveResult = await saveResponse.json().catch(() => ({}));
      if (!saveResponse.ok) throw new Error(saveResult.message ?? "푸시 토큰을 저장하지 못했습니다.");

      const nextPrefs = { ...prefs, browser_push: true, chat_messages: true };
      setPrefs(nextPrefs);
      await fetch("/api/notifications/preferences", {
        method: "PUT",
        headers: { "content-type": "application/json", authorization: `Bearer ${authToken}` },
        body: JSON.stringify(nextPrefs),
      });
      setMessage("휴대폰 푸시 알림이 연결되었습니다. 앱을 닫아도 병원 채팅 알림이 소리와 진동으로 표시됩니다.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "푸시 알림 연결에 실패했습니다.");
    } finally {
      setWorking(false);
    }
  }

  async function save() {
    const token = await getToken();
    if (!token) return;
    const response = await fetch("/api/notifications/preferences", {
      method: "PUT",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify(prefs),
    });
    setMessage(response.ok ? "알림 설정을 저장했습니다." : "설정을 저장하지 못했습니다.");
  }

  return (
    <main className="min-h-screen bg-gray-50 px-5 py-8 text-black">
      <div className="mx-auto max-w-2xl">
        <Link href="/notifications" className="rounded-xl border bg-white px-4 py-2 text-sm">← 알림센터</Link>
        <h1 className="mt-8 text-3xl font-black">알림 설정</h1>

        <section className="mt-6 rounded-3xl border bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <strong>휴대폰 푸시 알림</strong>
              <p className="mt-1 text-sm text-gray-500">
                현재 상태: {permission === "granted" ? "권한 허용됨" : permission === "denied" ? "차단됨" : permission === "unsupported" ? "지원하지 않음" : "연결 전"}
              </p>
              <p className="mt-2 text-xs leading-5 text-gray-500">앱을 닫거나 화면을 잠가도 병원에서 새 메시지가 오면 시스템 알림으로 알려드립니다.</p>
            </div>
            <button type="button" disabled={working} onClick={() => void enableBrowserNotification()} className="rounded-2xl bg-[#153f34] px-5 py-3 font-bold text-white disabled:opacity-50">
              {working ? "연결 중..." : "푸시 알림 연결"}
            </button>
          </div>
        </section>

        <div className="mt-4 space-y-3">
          {labels.map(([key, title, description]) => (
            <label key={key} className="flex cursor-pointer items-center justify-between gap-5 rounded-3xl border bg-white p-5">
              <div><strong>{title}</strong><p className="mt-1 text-sm text-gray-500">{description}</p></div>
              <input type="checkbox" checked={prefs[key] ?? false} onChange={(event) => setPrefs((current) => ({ ...current, [key]: event.target.checked }))} className="h-5 w-5" />
            </label>
          ))}
        </div>

        {message && <p className="mt-5 rounded-xl bg-white p-4 text-sm leading-6">{message}</p>}
        <button onClick={() => void save()} className="mt-5 w-full rounded-2xl bg-black p-4 font-bold text-white">설정 저장</button>
      </div>
    </main>
  );
}
