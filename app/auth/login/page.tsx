"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";

type SocialProvider = "google" | "kakao" | "custom:naver";

export default function GuardianLoginPage() {
  const router = useRouter();
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let mounted = true;

    async function checkSession() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.user) return;

        const { data: hospitalAdmin } = await supabase
          .from("hospital_admins")
          .select("hospital_id")
          .eq("user_id", session.user.id)
          .maybeSingle();

        const { data: superAdmin } = await supabase
          .from("super_admins")
          .select("user_id")
          .eq("user_id", session.user.id)
          .maybeSingle();

        if (!mounted) return;

        if (hospitalAdmin?.hospital_id || superAdmin?.user_id) {
          await supabase.auth.signOut();
          setErrorMessage("보호자 앱에서는 보호자 계정만 로그인할 수 있습니다.");
          return;
        }

        router.replace("/");
      } finally {
        if (mounted) setIsCheckingSession(false);
      }
    }

    void checkSession();
    return () => {
      mounted = false;
    };
  }, [router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");
    setIsLoading(true);

    const formData = new FormData(event.currentTarget);
    const username = String(formData.get("username") ?? "").trim().toLowerCase();
    const password = String(formData.get("password") ?? "");

    if (!username || !password) {
      setErrorMessage("아이디와 비밀번호를 입력해 주세요.");
      setIsLoading(false);
      return;
    }

    const { data: loginEmail, error: lookupError } = await supabase.rpc(
      "get_login_email",
      { login_username: username },
    );

    if (lookupError || !loginEmail) {
      setErrorMessage("아이디 또는 비밀번호가 올바르지 않습니다.");
      setIsLoading(false);
      return;
    }

    const {
      data: { user },
      error,
    } = await supabase.auth.signInWithPassword({
      email: String(loginEmail),
      password,
    });

    if (error || !user) {
      setErrorMessage("아이디 또는 비밀번호가 올바르지 않습니다.");
      setIsLoading(false);
      return;
    }

    const [{ data: profile }, { data: hospitalAdmin }, { data: superAdmin }] =
      await Promise.all([
        supabase.from("profiles").select("account_type").eq("id", user.id).maybeSingle(),
        supabase.from("hospital_admins").select("hospital_id").eq("user_id", user.id).maybeSingle(),
        supabase.from("super_admins").select("user_id").eq("user_id", user.id).maybeSingle(),
      ]);

    if (
      profile?.account_type !== "guardian" ||
      hospitalAdmin?.hospital_id ||
      superAdmin?.user_id
    ) {
      await supabase.auth.signOut();
      setErrorMessage("보호자 계정이 아닙니다. 병원 계정은 PAWU Hospital에서 로그인해 주세요.");
      setIsLoading(false);
      return;
    }

    router.replace("/");
    router.refresh();
  }

  async function handleSocialLogin(provider: SocialProvider) {
    setErrorMessage("");
    setIsLoading(true);
    window.localStorage.setItem("pawu_social_provider", provider);

    if (provider === "kakao") {
      window.location.href = "/api/auth/kakao/start";
      return;
    }

    if (provider === "custom:naver") {
      window.location.href = "/api/auth/naver/start";
      return;
    }

    const { error } = await supabase.auth.signInWithOAuth({
      provider: provider as never,
      options: {
        redirectTo: `${window.location.origin}/auth/social-complete`,
      },
    });

    if (error) {
      window.localStorage.removeItem("pawu_social_provider");
      setErrorMessage("간편 로그인을 시작하지 못했습니다.");
      setIsLoading(false);
    }
  }

  if (isCheckingSession) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 px-5 text-black">
        <p className="text-sm text-gray-500">로그인 상태를 확인하고 있습니다...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 px-5 py-8 text-black">
      <div className="mx-auto w-full max-w-md">
        <Link href="/" className="inline-block rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm">
          ← PAWU 홈
        </Link>

        <header className="mt-10">
          <p className="text-sm text-gray-500">PAWU 보호자</p>
          <h1 className="mt-2 text-3xl font-bold">보호자 로그인</h1>
          <p className="mt-3 text-sm leading-6 text-gray-600">
            반려동물 보호자 계정으로 로그인해 주세요.
          </p>
        </header>

        <form onSubmit={handleSubmit} className="mt-8 rounded-3xl border border-gray-200 bg-white p-6">
          <label htmlFor="username" className="mb-2 block text-sm font-medium">아이디</label>
          <input
            id="username"
            name="username"
            type="text"
            required
            autoComplete="username"
            disabled={isLoading}
            className="w-full rounded-2xl border border-gray-300 px-4 py-3 outline-none focus:border-black"
          />

          <label htmlFor="password" className="mb-2 mt-5 block text-sm font-medium">비밀번호</label>
          <input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
            disabled={isLoading}
            className="w-full rounded-2xl border border-gray-300 px-4 py-3 outline-none focus:border-black"
          />

          {errorMessage && (
            <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {errorMessage}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="mt-6 w-full rounded-2xl bg-black px-5 py-4 font-medium text-white disabled:bg-gray-400"
          >
            {isLoading ? "로그인 처리 중..." : "로그인"}
          </button>

          <div className="mt-5 text-center text-sm text-gray-500">
            계정이 없나요?{" "}
            <Link href="/auth/signup" className="font-semibold text-black underline">
              보호자 회원가입
            </Link>
          </div>
        </form>

        <div className="my-7 flex items-center gap-4">
          <div className="h-px flex-1 bg-gray-200" />
          <span className="text-xs text-gray-400">간편 로그인</span>
          <div className="h-px flex-1 bg-gray-200" />
        </div>

        <section className="space-y-3">
          <button type="button" onClick={() => handleSocialLogin("google")} disabled={isLoading}
            className="w-full rounded-2xl border border-gray-300 bg-white px-5 py-4 font-semibold">
            Google로 로그인
          </button>
          <button type="button" onClick={() => handleSocialLogin("kakao")} disabled={isLoading}
            className="w-full rounded-2xl bg-[#FEE500] px-5 py-4 font-semibold">
            카카오로 로그인
          </button>
          <button type="button" onClick={() => handleSocialLogin("custom:naver")} disabled={isLoading}
            className="w-full rounded-2xl bg-[#03C75A] px-5 py-4 font-semibold text-white">
            네이버로 로그인
          </button>
        </section>
      </div>
    </main>
  );
}
