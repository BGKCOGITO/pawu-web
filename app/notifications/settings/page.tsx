"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

const labels: Array<[string, string, string]> = [
  ["reservation_updates", "예약 알림", "예약 승인, 변경, 취소 상태를 받습니다."],
  ["chat_messages", "채팅 알림", "병원이나 보호자의 새 메시지를 받습니다."],
  ["medical_updates", "진료기록 알림", "진료 완료와 건강수첩 갱신을 받습니다."],
  ["medication_reminders", "복약 알림", "등록된 약 복용 시간을 안내합니다."],
  ["vaccination_reminders", "예방접종 알림", "예정된 예방접종 시기를 안내합니다."],
  ["marketing", "마케팅 알림", "PAWU 이벤트와 혜택을 받습니다."],
];

export default function NotificationSettingsPage() {
  const [prefs, setPrefs] = useState<Record<string, boolean>>({});
  const [message, setMessage] = useState("");
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
    if (typeof Notification === "undefined") {
      setMessage("이 기기에서는 브라우저 알림을 지원하지 않습니다.");
      return;
    }
    const next = await Notification.requestPermission();
    setPermission(next);
    if (next === "granted") {
      setPrefs((current) => ({ ...current, browser_push: true, chat_messages: true }));
      setMessage("브라우저 알림을 허용했습니다. 앱이 열려 있거나 실행 중일 때 새 채팅 알림과 소리가 표시됩니다.");
    } else {
      setMessage("알림 권한이 허용되지 않았습니다. 휴대폰 설정에서 PAWU 알림을 허용해 주세요.");
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
              <strong>휴대폰 알림 권한</strong>
              <p className="mt-1 text-sm text-gray-500">
                현재 상태: {permission === "granted" ? "허용됨" : permission === "denied" ? "차단됨" : permission === "unsupported" ? "지원하지 않음" : "허용 전"}
              </p>
            </div>
            <button type="button" onClick={() => void enableBrowserNotification()} className="rounded-2xl bg-[#153f34] px-5 py-3 font-bold text-white">
              알림 켜기
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
