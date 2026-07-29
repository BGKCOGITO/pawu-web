"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { supabase } from "../../../../lib/supabase";
import ConsentChecklist, {
  type ConsentState,
} from "../../../../components/auth/ConsentChecklist";

type SignupStep = "consent" | "identity" | "account";
type SocialProvider = "google" | "kakao" | "custom:naver";

const POLICY_VERSION = "2026-07-22";

const initialConsents: ConsentState = {
  terms: false,
  privacy: false,
  identity: false,
  age14: false,
  marketing: false,
};

function formatPhoneInput(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11);

  if (digits.length <= 3) return digits;
  if (digits.length <= 7) {
    return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  }

  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
}

function providerLabel(provider: SocialProvider) {
  if (provider === "google") return "구글";
  if (provider === "kakao") return "카카오";
  return "네이버";
}

export default function SignupPage() {
  const [step, setStep] = useState<SignupStep>("consent");
  const [consents, setConsents] =
    useState<ConsentState>(initialConsents);

  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [verificationId, setVerificationId] = useState("");
  const [verifiedPhone, setVerifiedPhone] = useState("");

  const [isLoading, setIsLoading] = useState(false);
  const [loadingProvider, setLoadingProvider] =
    useState<SocialProvider | null>(null);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const requiredConsentsAccepted =
    consents.terms &&
    consents.privacy &&
    consents.identity &&
    consents.age14;

  const currentStep =
    step === "consent" ? 1 : step === "identity" ? 2 : 3;

  function resetMessages() {
    setMessage("");
    setErrorMessage("");
  }

  function savePendingSignup(provider: string) {
    window.localStorage.setItem(
      "pawu_pending_signup",
      JSON.stringify({
        policyVersion: POLICY_VERSION,
        consents,
        provider,
        createdAt: new Date().toISOString(),
      }),
    );
  }

  async function sendSms() {
    resetMessages();

    if (!requiredConsentsAccepted) {
      setErrorMessage("필수 약관에 모두 동의해 주세요.");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/sms/send", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ phone }),
      });

      const result = (await response.json()) as {
        ok?: boolean;
        verificationId?: string;
        message?: string;
      };

      if (!response.ok || !result.verificationId) {
        throw new Error(
          result.message ?? "인증번호 발송에 실패했습니다.",
        );
      }

      setVerificationId(result.verificationId);
      setCode("");
      setMessage("인증번호를 발송했습니다. 3분 안에 입력해 주세요.");
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "인증번호 발송에 실패했습니다.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function verifySms() {
    resetMessages();

    if (!verificationId) {
      setErrorMessage("먼저 인증번호를 발송해 주세요.");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/sms/verify", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          verificationId,
          phone,
          code,
        }),
      });

      const result = (await response.json()) as {
        ok?: boolean;
        phone?: string;
        message?: string;
      };

      if (!response.ok || !result.phone) {
        throw new Error(
          result.message ?? "휴대폰 인증에 실패했습니다.",
        );
      }

      setVerifiedPhone(result.phone);
      setStep("account");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "휴대폰 인증에 실패했습니다.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function finalizeSignup(
    accessToken: string,
    provider: string,
  ) {
    const response = await fetch("/api/auth/signup/finalize", {
      method: "POST",
      headers: {
        authorization: `Bearer ${accessToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        policyVersion: POLICY_VERSION,
        consents,
        provider,
      }),
    });

    const result = (await response.json()) as {
      ok?: boolean;
      message?: string;
    };

    if (!response.ok || !result.ok) {
      throw new Error(
        result.message ?? "회원가입 완료 처리에 실패했습니다.",
      );
    }
  }

  async function signupWithEmail(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    resetMessages();

    if (!verifiedPhone) {
      setErrorMessage("휴대폰 인증을 다시 진행해 주세요.");
      setStep("identity");
      return;
    }

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    const passwordConfirm = String(
      formData.get("passwordConfirm") ?? "",
    );

    if (password.length < 6) {
      setErrorMessage("비밀번호는 6자 이상이어야 합니다.");
      return;
    }

    if (password !== passwordConfirm) {
      setErrorMessage("비밀번호 확인이 일치하지 않습니다.");
      return;
    }

    setIsLoading(true);
    savePendingSignup("email");

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/social-complete`,
          data: {
            account_type: "guardian",
          },
        },
      });

      if (error) throw error;

      if (data.session?.access_token) {
        await finalizeSignup(
          data.session.access_token,
          "email",
        );
        window.localStorage.removeItem("pawu_pending_signup");
        await supabase.auth.signOut();
        window.location.href =
          "/auth/login?signup=complete";
        return;
      }

      setMessage(
        "확인 이메일을 발송했습니다. 이메일의 인증 링크를 누르면 가입이 완료됩니다.",
      );
    } catch (error) {
      window.localStorage.removeItem("pawu_pending_signup");
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "이메일 회원가입에 실패했습니다.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function signupWithSocial(
    provider: SocialProvider,
  ) {
    resetMessages();

    if (!verifiedPhone) {
      setErrorMessage("휴대폰 인증을 다시 진행해 주세요.");
      setStep("identity");
      return;
    }

    setLoadingProvider(provider);
    savePendingSignup(provider);

    const { error } = await supabase.auth.signInWithOAuth({
      provider: provider as never,
      options: {
        redirectTo: `${window.location.origin}/auth/social-complete`,
        queryParams:
          provider === "google"
            ? {
                access_type: "offline",
                prompt: "consent",
              }
            : undefined,
      },
    });

    if (error) {
      window.localStorage.removeItem("pawu_pending_signup");
      setErrorMessage(
        `${providerLabel(provider)} 가입을 시작하지 못했습니다. Provider 설정을 확인해 주세요.`,
      );
      setLoadingProvider(null);
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 px-5 py-8 text-black">
      <div className="mx-auto w-full max-w-md">
        <Link
          href="/auth/login"
          className="inline-flex rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm"
        >
          ← 로그인으로
        </Link>

        <header className="mt-9">
          <p className="text-sm font-medium text-gray-500">
            PAWU 보호자 계정
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">
            회원가입
          </h1>
          <p className="mt-3 text-sm leading-6 text-gray-600">
            약관 동의, 휴대폰 인증, 계정 설정 순서로 진행합니다.
          </p>
        </header>

        <div className="mt-7 flex items-center gap-2">
          {[1, 2, 3].map((number) => (
            <div key={number} className="flex flex-1 items-center gap-2">
              <div
                className={[
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                  currentStep >= number
                    ? "bg-black text-white"
                    : "bg-gray-200 text-gray-500",
                ].join(" ")}
              >
                {currentStep > number ? "✓" : number}
              </div>
              {number < 3 && (
                <div
                  className={[
                    "h-1 flex-1 rounded-full",
                    currentStep > number
                      ? "bg-black"
                      : "bg-gray-200",
                  ].join(" ")}
                />
              )}
            </div>
          ))}
        </div>

        <div className="mt-3 grid grid-cols-3 text-center text-xs font-medium text-gray-500">
          <span>약관 동의</span>
          <span>휴대폰 인증</span>
          <span>계정 설정</span>
        </div>

        {step === "consent" && (
          <section className="mt-7">
            <ConsentChecklist
              value={consents}
              onChange={setConsents}
              disabled={isLoading}
            />

            <button
              type="button"
              disabled={!requiredConsentsAccepted}
              onClick={() => {
                resetMessages();
                setStep("identity");
              }}
              className="mt-5 w-full rounded-2xl bg-black px-5 py-4 font-semibold text-white disabled:bg-gray-300"
            >
              동의하고 다음
            </button>
          </section>
        )}

        {step === "identity" && (
          <section className="mt-7 rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold">
              휴대폰 인증
            </h2>
            <p className="mt-2 text-sm leading-6 text-gray-500">
              Solapi 문자로 받은 6자리 번호를 입력해 주세요.
            </p>

            <label className="mt-6 block text-sm font-medium">
              휴대폰 번호
              <div className="mt-2 flex gap-2">
                <input
                  value={phone}
                  onChange={(event) => {
                    setPhone(
                      formatPhoneInput(event.target.value),
                    );
                    setVerificationId("");
                    setCode("");
                    resetMessages();
                  }}
                  type="tel"
                  inputMode="numeric"
                  placeholder="010-1234-5678"
                  className="min-w-0 flex-1 rounded-2xl border border-gray-300 px-4 py-3 outline-none focus:border-black"
                />
                <button
                  type="button"
                  onClick={sendSms}
                  disabled={isLoading}
                  className="shrink-0 rounded-2xl border border-black px-4 py-3 text-sm font-semibold disabled:border-gray-300 disabled:text-gray-400"
                >
                  {verificationId ? "재발송" : "인증번호 발송"}
                </button>
              </div>
            </label>

            {verificationId && (
              <label className="mt-5 block text-sm font-medium">
                인증번호
                <input
                  value={code}
                  onChange={(event) =>
                    setCode(
                      event.target.value
                        .replace(/\D/g, "")
                        .slice(0, 6),
                    )
                  }
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="6자리"
                  className="mt-2 w-full rounded-2xl border border-gray-300 px-4 py-3 tracking-[0.35em] outline-none focus:border-black"
                />
                <button
                  type="button"
                  onClick={verifySms}
                  disabled={isLoading}
                  className="mt-4 w-full rounded-2xl bg-black px-5 py-4 font-semibold text-white disabled:bg-gray-400"
                >
                  {isLoading ? "확인 중..." : "인증 완료"}
                </button>
              </label>
            )}

            <button
              type="button"
              onClick={() => setStep("consent")}
              className="mt-4 w-full rounded-2xl border border-gray-300 px-5 py-3 text-sm font-medium"
            >
              이전 단계
            </button>
          </section>
        )}

        {step === "account" && (
          <section className="mt-7">
            <div className="rounded-2xl border border-green-200 bg-green-50 p-4">
              <p className="text-sm font-semibold text-green-700">
                휴대폰 인증이 완료되었습니다
              </p>
              <p className="mt-1 text-xs text-green-600">
                {verifiedPhone}
              </p>
            </div>

            <div className="mt-5 space-y-3">
              <button
                type="button"
                onClick={() => signupWithSocial("kakao")}
                disabled={loadingProvider !== null}
                className="w-full rounded-2xl bg-[#FEE500] px-5 py-4 font-bold"
              >
                {loadingProvider === "kakao"
                  ? "카카오 연결 중..."
                  : "카카오로 가입"}
              </button>

              <button
                type="button"
                onClick={() =>
                  signupWithSocial("custom:naver")
                }
                disabled={loadingProvider !== null}
                className="w-full rounded-2xl bg-[#03C75A] px-5 py-4 font-bold text-white"
              >
                {loadingProvider === "custom:naver"
                  ? "네이버 연결 중..."
                  : "네이버로 가입"}
              </button>

              <button
                type="button"
                onClick={() => signupWithSocial("google")}
                disabled={loadingProvider !== null}
                className="w-full rounded-2xl border border-gray-300 bg-white px-5 py-4 font-bold"
              >
                {loadingProvider === "google"
                  ? "구글 연결 중..."
                  : "구글로 가입"}
              </button>
            </div>

            <div className="my-7 flex items-center gap-4">
              <div className="h-px flex-1 bg-gray-200" />
              <span className="text-xs text-gray-400">
                이메일로 가입
              </span>
              <div className="h-px flex-1 bg-gray-200" />
            </div>

            <form
              onSubmit={signupWithEmail}
              className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm"
            >
              <label className="block text-sm font-medium">
                이메일
                <input
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  className="mt-2 w-full rounded-2xl border border-gray-300 px-4 py-3 outline-none focus:border-black"
                />
              </label>

              <label className="mt-5 block text-sm font-medium">
                비밀번호
                <input
                  name="password"
                  type="password"
                  required
                  minLength={6}
                  autoComplete="new-password"
                  className="mt-2 w-full rounded-2xl border border-gray-300 px-4 py-3 outline-none focus:border-black"
                />
              </label>

              <label className="mt-5 block text-sm font-medium">
                비밀번호 확인
                <input
                  name="passwordConfirm"
                  type="password"
                  required
                  minLength={6}
                  autoComplete="new-password"
                  className="mt-2 w-full rounded-2xl border border-gray-300 px-4 py-3 outline-none focus:border-black"
                />
              </label>

              <button
                type="submit"
                disabled={isLoading}
                className="mt-6 w-full rounded-2xl bg-black px-5 py-4 font-semibold text-white disabled:bg-gray-400"
              >
                {isLoading
                  ? "가입 처리 중..."
                  : "이메일로 가입"}
              </button>
            </form>
          </section>
        )}

        {message && (
          <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-700">
            {message}
          </div>
        )}

        {errorMessage && (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-700">
            {errorMessage}
          </div>
        )}
      </div>
    </main>
  );
}
