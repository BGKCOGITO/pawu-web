"use client";

import { useEffect, useState } from "react";
import {
  connectGuardianPush,
  disconnectGuardianPush,
  getPushRegistrationStatus,
  type PushStage,
} from "@/lib/push/client";

export default function NotificationSettingsPage() {
  const [registered, setRegistered] =
    useState(false);
  const [working, setWorking] =
    useState(false);
  const [message, setMessage] =
    useState("");
  const [stage, setStage] =
    useState<PushStage>("idle");

  async function refresh() {
    const status =
      await getPushRegistrationStatus();
    setRegistered(status.registered);
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function connect(resetToken = false) {
    setWorking(true);
    setMessage("");

    const result = await connectGuardianPush({
      requestPermission: true,
      resetToken,
      onStage(nextStage, nextMessage) {
        setStage(nextStage);
        setMessage(nextMessage);
      },
    });

    setStage(result.stage);
    setMessage(result.message);
    setWorking(false);
    await refresh();
  }

  async function disconnect() {
    setWorking(true);
    await disconnectGuardianPush();
    await refresh();
    setMessage(
      "이 기기의 푸시 알림 연결을 해제했습니다.",
    );
    setWorking(false);
  }

  return (
    <main className="mx-auto min-h-screen max-w-2xl bg-white px-5 py-8">
      <h1 className="text-2xl font-black text-[#153f34]">
        알림 설정
      </h1>

      <section className="mt-6 rounded-3xl border border-slate-200 p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-black">
              휴대폰 푸시 알림
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              앱을 닫아도 병원 채팅과 주요 알림을 받습니다.
            </p>
          </div>

          <span
            className={`rounded-full px-3 py-1 text-xs font-bold ${
              registered
                ? "bg-emerald-100 text-emerald-700"
                : "bg-slate-100 text-slate-600"
            }`}
          >
            {registered ? "연결됨" : "연결 안 됨"}
          </span>
        </div>

        {message && (
          <div className="mt-4 rounded-2xl bg-slate-50 p-3 text-sm leading-6">
            <strong>{stage}</strong>
            <p>{message}</p>
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={working}
            onClick={() => void connect(false)}
            className="rounded-2xl bg-[#153f34] px-4 py-3 text-sm font-bold text-white disabled:opacity-50"
          >
            {working
              ? "처리 중..."
              : registered
                ? "연결 확인"
                : "알림 허용 및 연결"}
          </button>

          <button
            type="button"
            disabled={working}
            onClick={() => void connect(true)}
            className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800 disabled:opacity-50"
          >
            토큰 초기화 후 재연결
          </button>

          {registered && (
            <button
              type="button"
              disabled={working}
              onClick={() => void disconnect()}
              className="rounded-2xl border border-slate-300 px-4 py-3 text-sm font-bold"
            >
              연결 해제
            </button>
          )}
        </div>
      </section>
    </main>
  );
}
