"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

type Status = "loading" | "complete" | "error";

const providerNames: Record<string, string> = {
  kakao: "카카오",
  "custom:naver": "네이버",
  naver: "네이버",
  apple: "Apple",
};

async function waitForSession(): Promise<Session | null> {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error) {
    throw new Error(`로그인 세션 조회 실패: ${error.message}`);
  }

  if (session) return session;

  return await new Promise<Session | null>((resolve) => {
    let finished = false;

    const finish = (sessionValue: Session | null) => {
      if (finished) return;
      finished = true;
      window.clearTimeout(timer);
      subscription.unsubscribe();
      resolve(sessionValue);
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (
        nextSession &&
        ["SIGNED_IN", "INITIAL_SESSION", "TOKEN_REFRESHED"].includes(event)
      ) {
        finish(nextSession);
      }
    });

    const timer = window.setTimeout(async () => {
      const {
        data: { session: finalSession },
      } = await supabase.auth.getSession();

      finish(finalSession);
    }, 10000);
  });
}

export default function SocialCompletePage() {
  const [status, setStatus] = useState<Status>("loading");
  const [message, setMessage] = useState(
    "소셜 로그인 정보를 확인하고 있습니다.",
  );

  useEffect(() => {
    let mounted = true;

    async function complete() {
      try {
        const session = await waitForSession();

        if (!session?.user || !session.access_token) {
          throw new Error(
            "로그인 세션이 생성되지 않았습니다. 로그인 페이지에서 다시 시도해 주세요.",
          );
        }

        const provider =
          String(
            session.user.app_metadata?.provider ??
              window.localStorage.getItem("pawu_social_provider") ??
              "social",
          );

        const providerName = providerNames[provider] ?? "소셜";

        if (mounted) {
          setMessage(`${providerName} 로그인 정보를 확인하고 있습니다.`);
        }

        const response = await fetch("/api/auth/social/complete", {
          method: "POST",
          headers: {
            authorization: `Bearer ${session.access_token}`,
          },
        });

        const result = (await response.json()) as {
          ok?: boolean;
          message?: string;
          redirectPath?: string;
        };

        if (!response.ok || !result.ok) {
          throw new Error(
            result.message ?? "소셜 로그인 완료 처리에 실패했습니다.",
          );
        }

        window.localStorage.removeItem("pawu_social_provider");

        if (!mounted) return;

        setStatus("complete");
        setMessage(`${providerName} 로그인이 완료되었습니다.`);

        window.setTimeout(() => {
          window.location.replace(result.redirectPath ?? "/");
        }, 500);
      } catch (error) {
        console.error("소셜 로그인 완료 처리 오류:", error);

        if (!mounted) return;

        setStatus("error");
        setMessage(
          error instanceof Error
            ? error.message
            : "소셜 로그인을 완료하지 못했습니다.",
        );
      }
    }

    void complete();

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f4f0e8] px-5 py-8 text-[#173e35]">
      <section className="w-full max-w-md rounded-[32px] border border-black/10 bg-white p-8 text-center shadow-sm">
        <div className="text-4xl">
          {status === "loading" ? "…" : status === "complete" ? "✓" : "!"}
        </div>

        <h1 className="mt-5 text-2xl font-bold">
          {status === "loading"
            ? "로그인 처리 중"
            : status === "complete"
              ? "로그인 완료"
              : "로그인 확인 필요"}
        </h1>

        <p className="mt-3 text-sm leading-6 text-slate-600">{message}</p>

        {status === "error" && (
          <Link
            href="/auth/login"
            className="mt-8 block w-full rounded-2xl bg-[#173e35] px-5 py-4 font-bold text-white"
          >
            로그인 다시 시도
          </Link>
        )}
      </section>
    </main>
  );
}
