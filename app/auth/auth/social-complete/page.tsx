"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "../../../../lib/supabase";

type PendingSignup = {
  policyVersion: string;
  consents: {
    terms: boolean;
    privacy: boolean;
    identity: boolean;
    age14: boolean;
    marketing: boolean;
  };
  provider: string;
  createdAt: string;
};

export default function SocialCompletePage() {
  const [status, setStatus] = useState<
    "loading" | "complete" | "error"
  >("loading");
  const [message, setMessage] = useState(
    "회원가입 정보를 확인하고 있습니다.",
  );

  useEffect(() => {
    let cancelled = false;

    async function completeSignup() {
      try {
        const raw = window.localStorage.getItem(
          "pawu_pending_signup",
        );

        if (!raw) {
          throw new Error(
            "가입 진행 정보를 찾지 못했습니다. 회원가입을 다시 진행해 주세요.",
          );
        }

        const pending = JSON.parse(raw) as PendingSignup;
        const createdAt = new Date(pending.createdAt).getTime();

        if (
          !Number.isFinite(createdAt) ||
          Date.now() - createdAt > 30 * 60_000
        ) {
          throw new Error(
            "가입 진행 시간이 만료되었습니다. 다시 진행해 주세요.",
          );
        }

        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError || !session?.access_token) {
          throw new Error(
            "로그인 세션을 확인하지 못했습니다.",
          );
        }

        const response = await fetch(
          "/api/auth/signup/finalize",
          {
            method: "POST",
            headers: {
              authorization: `Bearer ${session.access_token}`,
              "content-type": "application/json",
            },
            body: JSON.stringify({
              policyVersion: pending.policyVersion,
              consents: pending.consents,
              provider: pending.provider,
            }),
          },
        );

        const result = (await response.json()) as {
          ok?: boolean;
          message?: string;
        };

        if (!response.ok || !result.ok) {
          throw new Error(
            result.message ??
              "회원가입 완료 처리에 실패했습니다.",
          );
        }

        window.localStorage.removeItem(
          "pawu_pending_signup",
        );
        await supabase.auth.signOut();

        if (!cancelled) {
          setStatus("complete");
          setMessage("회원가입이 완료되었습니다.");
        }
      } catch (error) {
        console.error("회원가입 완료 오류:", error);

        if (!cancelled) {
          setStatus("error");
          setMessage(
            error instanceof Error
              ? error.message
              : "회원가입을 완료하지 못했습니다.",
          );
        }
      }
    }

    void completeSignup();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="min-h-screen bg-gray-50 px-5 py-8 text-black">
      <div className="mx-auto w-full max-w-md">
        <section className="mt-20 rounded-3xl border border-gray-200 bg-white p-8 text-center shadow-sm">
          <div className="text-4xl">
            {status === "loading"
              ? "…"
              : status === "complete"
                ? "✓"
                : "!"}
          </div>

          <h1 className="mt-5 text-2xl font-bold">
            {status === "loading"
              ? "가입 처리 중"
              : status === "complete"
                ? "가입 완료"
                : "가입 확인 필요"}
          </h1>

          <p className="mt-3 text-sm leading-6 text-gray-600">
            {message}
          </p>

          {status === "complete" && (
            <Link
              href="/auth/login?signup=complete"
              className="mt-8 block w-full rounded-2xl bg-black px-5 py-4 font-semibold text-white"
            >
              로그인 화면으로
            </Link>
          )}

          {status === "error" && (
            <Link
              href="/auth/signup"
              className="mt-8 block w-full rounded-2xl bg-black px-5 py-4 font-semibold text-white"
            >
              회원가입 다시 진행
            </Link>
          )}
        </section>
      </div>
    </main>
  );
}
