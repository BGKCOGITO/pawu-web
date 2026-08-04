"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";
import {
  connectGuardianPush,
  getPushRegistrationStatus,
  installForegroundPushListener,
  type PushStage,
} from "@/lib/push/client";
import { supabase } from "@/lib/supabase";

const DISMISS_KEY =
  "pawu_push_prompt_dismissed_session";

function guardianPath() {
  const path = window.location.pathname;

  return ![
    "/hospital-admin",
    "/auth/hospital",
    "/admin",
    "/super-admin",
    "/platform",
  ].some((prefix) => path.startsWith(prefix));
}

const STAGE_LABELS: Record<PushStage, string> = {
  idle: "대기",
  permission: "권한 확인",
  config: "Firebase 설정",
  "service-worker": "백그라운드 서비스",
  firebase: "Firebase 초기화",
  token: "토큰 발급",
  save: "서버 저장",
  complete: "완료",
};

export default function PushNotificationManager() {
  const [visible, setVisible] = useState(false);
  const [working, setWorking] = useState(false);
  const [stage, setStage] =
    useState<PushStage>("idle");
  const [message, setMessage] = useState(
    "앱을 닫아도 병원 메시지를 받으려면 알림을 연결해 주세요.",
  );

  const inspect = useCallback(async () => {
    if (
      typeof window === "undefined" ||
      !guardianPath()
    ) {
      setVisible(false);
      return;
    }

    const { data } =
      await supabase.auth.getSession();

    if (!data.session) {
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

    const status =
      await getPushRegistrationStatus();

    if (status.registered) {
      setVisible(false);
      return;
    }

    if (Notification.permission === "denied") {
      setMessage(
        "휴대폰 설정에서 PAWU 알림 권한을 허용한 뒤 다시 연결해 주세요.",
      );
      setVisible(true);
      return;
    }

    if (
      Notification.permission === "granted"
    ) {
      setWorking(true);
      const result = await connectGuardianPush({
        onStage(nextStage, nextMessage) {
          setStage(nextStage);
          setMessage(nextMessage);
        },
      });
      setWorking(false);

      if (result.ok) {
        setVisible(false);
        return;
      }

      setStage(result.stage);
      setMessage(result.message);
      setVisible(true);
      return;
    }

    if (
      sessionStorage.getItem(DISMISS_KEY) !==
      "1"
    ) {
      setVisible(true);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(
      () => void inspect(),
      1000,
    );

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (event) => {
        if (
          event === "SIGNED_IN" ||
          event === "TOKEN_REFRESHED"
        ) {
          window.setTimeout(
            () => void inspect(),
            700,
          );
        }

        if (event === "SIGNED_OUT") {
          setVisible(false);
        }
      },
    );

    let removeForeground: (() => void) | undefined;

    void installForegroundPushListener().then(
      (remove) => {
        removeForeground = remove;
      },
    );

    return () => {
      window.clearTimeout(timer);
      subscription.unsubscribe();
      removeForeground?.();
    };
  }, [inspect]);

  async function connect(resetToken = false) {
    setWorking(true);
    setStage("permission");
    setMessage(
      "알림 권한을 확인하고 있습니다.",
    );

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

    if (result.ok) {
      window.setTimeout(
        () => setVisible(false),
        900,
      );
    }
  }

  if (!visible) return null;

  return (
    <div className="fixed inset-x-4 bottom-24 z-[150] mx-auto max-w-md rounded-3xl border border-[#b9d8cf] bg-white p-5 shadow-2xl md:bottom-6">
      <p className="text-xs font-black tracking-[0.16em] text-[#d86c57]">
        PAWU NOTIFICATION
      </p>

      <div className="mt-1 flex items-center justify-between gap-3">
        <h2 className="text-lg font-black text-[#153f34]">
          보호자 푸시 알림
        </h2>
        <span className="rounded-full bg-[#eef5f1] px-2.5 py-1 text-[11px] font-bold text-[#153f34]">
          {STAGE_LABELS[stage]}
        </span>
      </div>

      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">
        {message}
      </p>

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          disabled={working}
          onClick={() => void connect(false)}
          className="flex-1 rounded-2xl bg-[#153f34] px-4 py-3 text-sm font-bold text-white disabled:opacity-50"
        >
          {working
            ? "연결 중…"
            : "알림 허용 및 연결"}
        </button>

        {!working &&
          Notification.permission ===
            "granted" && (
            <button
              type="button"
              onClick={() => void connect(true)}
              className="rounded-2xl border border-amber-300 bg-amber-50 px-3 py-3 text-xs font-bold text-amber-800"
            >
              토큰 초기화
            </button>
          )}

        <button
          type="button"
          disabled={working}
          onClick={() => {
            sessionStorage.setItem(
              DISMISS_KEY,
              "1",
            );
            setVisible(false);
          }}
          className="rounded-2xl border border-slate-300 px-4 py-3 text-sm font-bold text-slate-600"
        >
          닫기
        </button>
      </div>
    </div>
  );
}
