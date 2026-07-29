"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";

type LoginTab = "guardian" | "hospital";
type SocialProvider = "google" | "kakao" | "custom:naver";

type HospitalSignupRequest = {
  status: "pending" | "approved" | "rejected";
  rejection_reason: string | null;
};

export default function LoginPage() {
  const router = useRouter();

  const [activeTab, setActiveTab] =
    useState<LoginTab>("guardian");
  const [isCheckingSession, setIsCheckingSession] =
    useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [noticeMessage, setNoticeMessage] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function checkSession() {
      try {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (error) {
          console.warn(
            "로그인 세션 확인 실패:",
            error.message,
          );
          return;
        }

        if (!session?.user) {
          return;
        }

        const { data: superAdmin, error: superAdminError } =
          await supabase
            .from("super_admins")
            .select("user_id")
            .eq("user_id", session.user.id)
            .maybeSingle();

        if (superAdminError) {
          console.warn(
            "최고관리자 확인 실패:",
            superAdminError.message,
          );
        }

        if (!isMounted) {
          return;
        }

        if (superAdmin?.user_id) {
          router.replace("/super-admin/hospitals");
          return;
        }

        const { data: hospitalAdmin, error: hospitalError } =
          await supabase
            .from("hospital_admins")
            .select("hospital_id")
            .eq("user_id", session.user.id)
            .maybeSingle();

        if (hospitalError) {
          console.warn(
            "병원 관리자 확인 실패:",
            hospitalError.message,
          );
        }

        if (!isMounted) {
          return;
        }

        if (hospitalAdmin?.hospital_id) {
          router.replace("/hospital-admin");
          return;
        }

        router.replace("/");
      } finally {
        if (isMounted) {
          setIsCheckingSession(false);
        }
      }
    }

    void checkSession();

    return () => {
      isMounted = false;
    };
  }, [router]);

  function resetMessages() {
    setErrorMessage("");
    setNoticeMessage("");
  }

  async function getHospitalSignupRequest(
    userId: string,
  ): Promise<HospitalSignupRequest | null> {
    const { data, error } = await supabase
      .from("hospital_signup_requests")
      .select("status, rejection_reason")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      console.warn(
        "병원 가입 신청 상태 확인 실패:",
        error.message,
      );
      return null;
    }

    return data as HospitalSignupRequest | null;
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    resetMessages();
    setIsLoading(true);

    const formData = new FormData(event.currentTarget);
    const username = String(
      formData.get("username") ?? "",
    )
      .trim()
      .toLowerCase();

    const password = String(
      formData.get("password") ?? "",
    );

    if (!username || !password) {
      setErrorMessage(
        "아이디와 비밀번호를 입력해 주세요.",
      );
      setIsLoading(false);
      return;
    }

    const { data: loginEmail, error: lookupError } =
      await supabase.rpc("get_login_email", {
        login_username: username,
      });

    if (lookupError || !loginEmail) {
      console.warn(
        "로그인 아이디 확인 실패:",
        lookupError?.message ?? "등록된 아이디 없음",
      );
      setErrorMessage(
        "아이디 또는 비밀번호가 올바르지 않습니다.",
      );
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
      console.warn(
        "로그인 실패:",
        error?.message ?? "사용자 정보 없음",
      );
      setErrorMessage(
        "아이디 또는 비밀번호가 올바르지 않습니다.",
      );
      setIsLoading(false);
      return;
    }

    const { data: superAdmin, error: superAdminError } =
      await supabase
        .from("super_admins")
        .select("user_id")
        .eq("user_id", user.id)
        .maybeSingle();

    if (superAdminError) {
      console.warn(
        "최고관리자 확인 실패:",
        superAdminError.message,
      );
    }

    const { data: profile, error: profileError } =
      await supabase
        .from("profiles")
        .select("account_type")
        .eq("id", user.id)
        .maybeSingle();

    if (profileError) {
      console.warn(
        "계정 유형 확인 실패:",
        profileError.message,
      );
    }

    const { data: hospitalAdmin, error: hospitalError } =
      await supabase
        .from("hospital_admins")
        .select("hospital_id")
        .eq("user_id", user.id)
        .maybeSingle();

    if (hospitalError) {
      console.warn(
        "병원 관리자 확인 실패:",
        hospitalError.message,
      );
    }

    if (activeTab === "guardian") {
      if (superAdmin?.user_id || profile?.account_type === "super_admin") {
        await supabase.auth.signOut();
        setErrorMessage(
          "최고관리자 계정입니다. 관리자 전용 로그인으로 이용해 주세요.",
        );
        setIsLoading(false);
        return;
      }

      if (
        profile?.account_type === "hospital" ||
        hospitalAdmin?.hospital_id
      ) {
        await supabase.auth.signOut();
        setErrorMessage(
          "병원 관리자 계정입니다. 병원 관리자 탭에서 로그인해 주세요.",
        );
        setIsLoading(false);
        return;
      }

      if (profile?.account_type !== "guardian") {
        await supabase.auth.signOut();
        setErrorMessage(
          "개인회원으로 이용할 수 없는 계정입니다.",
        );
        setIsLoading(false);
        return;
      }

      router.replace("/");
      router.refresh();
      return;
    }

    if (superAdmin?.user_id || profile?.account_type === "super_admin") {
      router.replace("/super-admin/hospitals");
      router.refresh();
      return;
    }

    if (activeTab === "hospital") {
      if (hospitalAdmin?.hospital_id) {
        router.replace("/hospital-admin");
        router.refresh();
        return;
      }

      const signupRequest =
        await getHospitalSignupRequest(user.id);

      await supabase.auth.signOut();

      if (signupRequest?.status === "pending") {
        setNoticeMessage(
          "병원 가입 신청을 검토 중입니다. 관리자 승인 후 이용할 수 있으며, 승인 결과는 등록한 휴대폰 번호로 문자 안내드립니다.",
        );
      } else if (signupRequest?.status === "rejected") {
        setErrorMessage(
          signupRequest.rejection_reason
            ? `병원 가입 신청이 반려되었습니다. 사유: ${signupRequest.rejection_reason}`
            : "병원 가입 신청이 반려되었습니다. 자세한 내용은 PAWU 관리자에게 문의해 주세요.",
        );
      } else if (signupRequest?.status === "approved") {
        setErrorMessage(
          "승인된 신청이지만 병원 관리자 권한 연결이 완료되지 않았습니다. PAWU 관리자에게 문의해 주세요.",
        );
      } else {
        setErrorMessage(
          "등록된 병원 관리자 계정이 아닙니다. 병원 회원가입을 먼저 진행해 주세요.",
        );
      }

      setIsLoading(false);
      return;
    }

    if (hospitalAdmin?.hospital_id) {
      router.replace("/hospital-admin");
      router.refresh();
      return;
    }

    await supabase.auth.signOut();
    setErrorMessage(
      "병원 관리자 계정이 아닙니다. 개인회원 탭을 이용해 주세요.",
    );
    setIsLoading(false);
  }

  async function handleSocialLogin(
    provider: SocialProvider,
  ) {
    resetMessages();
    setIsLoading(true);

    window.localStorage.setItem(
      "pawu_social_provider",
      provider,
    );

    /*
     * Supabase의 기본 Kakao Provider는 서버에서 account_email scope를
     * 항상 추가합니다. 현재 Kakao 앱은 이메일 권한이 없으므로
     * Kakao만 PAWU 서버의 직접 OAuth 경로를 사용합니다.
     */
    if (provider === "kakao") {
      window.location.href = "/api/auth/kakao/start";
      return;
    }

    if (provider === "custom:naver") {
      window.location.href = "/api/auth/naver/start";
      return;
    }

    const { error } =
      await supabase.auth.signInWithOAuth({
        provider: provider as never,
        options: {
          redirectTo: `${window.location.origin}/auth/social-complete`,
        },
      });

    if (error) {
      console.warn(
        `${provider} 로그인 시작 실패:`,
        error.message,
      );

      window.localStorage.removeItem(
        "pawu_social_provider",
      );

      const providerName =
        provider === "google"
          ? "Google"
          : provider === "kakao"
            ? "카카오"
            : "네이버";

      setErrorMessage(
        `${providerName} 로그인을 시작하지 못했습니다. 인증 제공자 설정을 확인해 주세요.`,
      );
      setIsLoading(false);
    }
  }

  if (isCheckingSession) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 px-5 text-black">
        <div className="rounded-3xl border border-gray-200 bg-white px-8 py-7 text-center">
          <p className="text-sm text-gray-500">
            로그인 상태를 확인하고 있습니다...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 px-5 py-8 text-black">
      <div className="mx-auto w-full max-w-md">
        <Link
          href="/"
          className="inline-block rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm"
        >
          ← PAWU 홈
        </Link>

        <header className="mt-10">
          <p className="text-sm text-gray-500">
            PAWU 계정
          </p>

          <h1 className="mt-2 text-3xl font-bold">
            로그인
          </h1>

          <p className="mt-3 text-sm leading-6 text-gray-600">
            보호자 또는 병원 관리자 계정으로
            로그인해 주세요.
          </p>
        </header>

        <div className="mt-8 grid grid-cols-2 rounded-2xl bg-gray-200 p-1">
          <button
            type="button"
            onClick={() => {
              setActiveTab("guardian");
              resetMessages();
            }}
            className={`rounded-xl px-4 py-3 text-sm font-semibold transition ${
              activeTab === "guardian"
                ? "bg-white text-black shadow-sm"
                : "text-gray-500"
            }`}
          >
            개인회원
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab("hospital");
              resetMessages();
            }}
            className={`rounded-xl px-4 py-3 text-sm font-semibold transition ${
              activeTab === "hospital"
                ? "bg-white text-black shadow-sm"
                : "text-gray-500"
            }`}
          >
            병원 관리자
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="mt-5 rounded-3xl border border-gray-200 bg-white p-6"
        >
          <div>
            <label
              htmlFor="username"
              className="mb-2 block text-sm font-medium"
            >
              아이디
            </label>

            <input
              id="username"
              name="username"
              type="text"
              required
              minLength={4}
              maxLength={20}
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="아이디"
              disabled={isLoading}
              className="w-full rounded-2xl border border-gray-300 px-4 py-3 outline-none focus:border-black disabled:bg-gray-100"
            />
          </div>

          <div className="mt-5">
            <label
              htmlFor="password"
              className="mb-2 block text-sm font-medium"
            >
              비밀번호
            </label>

            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              placeholder="비밀번호"
              disabled={isLoading}
              className="w-full rounded-2xl border border-gray-300 px-4 py-3 outline-none focus:border-black disabled:bg-gray-100"
            />
          </div>

          {noticeMessage && (
            <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-700">
              {noticeMessage}
            </div>
          )}

          {errorMessage && (
            <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-700">
              {errorMessage}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="mt-6 w-full rounded-2xl bg-black px-5 py-4 font-medium text-white disabled:bg-gray-400"
          >
            {isLoading
              ? "로그인 처리 중..."
              : activeTab === "hospital"
                ? "병원 관리자 로그인"
                : "로그인"}
          </button>

          <div className="mt-5 text-center text-sm text-gray-500">
            {activeTab === "hospital" ? (
              <>
                병원 계정이 없나요?{" "}
                <Link
                  href="/auth/hospital-signup"
                  className="font-semibold text-black underline"
                >
                  병원 회원가입
                </Link>
              </>
            ) : (
              <>
                계정이 없나요?{" "}
                <Link
                  href="/auth/signup"
                  className="font-semibold text-black underline"
                >
                  개인회원 가입
                </Link>
              </>
            )}
          </div>
        </form>

        {activeTab === "guardian" && (
          <>
            <div className="my-7 flex items-center gap-4">
              <div className="h-px flex-1 bg-gray-200" />
              <span className="text-xs text-gray-400">
                간편 로그인
              </span>
              <div className="h-px flex-1 bg-gray-200" />
            </div>

            <section className="space-y-3">
              <button
                type="button"
                onClick={() =>
                  handleSocialLogin("google")
                }
                disabled={isLoading}
                className="w-full rounded-2xl border border-gray-300 bg-white px-5 py-4 font-semibold text-black disabled:opacity-50"
              >
                Google로 로그인
              </button>

              <button
                type="button"
                onClick={() =>
                  handleSocialLogin("kakao")
                }
                disabled={isLoading}
                className="w-full rounded-2xl bg-[#FEE500] px-5 py-4 font-semibold text-black disabled:opacity-50"
              >
                카카오로 로그인
              </button>

              <button
                type="button"
                onClick={() =>
                  handleSocialLogin("custom:naver")
                }
                disabled={isLoading}
                className="w-full rounded-2xl bg-[#03C75A] px-5 py-4 font-semibold text-white disabled:opacity-50"
              >
                네이버로 로그인
              </button>

              <button
                type="button"
                disabled
                title="Apple Developer Program 가입 후 제공 예정"
                className="w-full cursor-not-allowed rounded-2xl bg-black px-5 py-4 font-semibold text-white opacity-45"
              >
                Apple 로그인 준비 중
              </button>

              <p className="px-2 pt-2 text-center text-xs leading-5 text-gray-400">
                Google·카카오·네이버 로그인은 개인회원 전용입니다. 최초 로그인 시
                예약에 필요한 이름과 휴대폰 번호를 한 번 확인합니다.
                Apple 로그인은 개발자 등록 완료 후 제공할 예정입니다.
              </p>
            </section>
          </>
        )}

        {activeTab === "hospital" && (
          <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-800">
            병원 계정은 사업자등록증 확인과 관리자
            승인 후 이용할 수 있습니다. 승인 또는 반려
            결과는 가입 시 인증한 휴대폰 번호로 문자
            안내드립니다.
          </div>
        )}
      </div>
    </main>
  );
}