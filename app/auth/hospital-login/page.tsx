"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";

type HospitalSignupRequest = {
  status: "pending" | "approved" | "rejected";
  rejection_reason: string | null;
};

export default function HospitalLoginPage() {
  const router = useRouter();
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [noticeMessage, setNoticeMessage] = useState("");

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

        if (!mounted) return;

        if (hospitalAdmin?.hospital_id) {
          router.replace("/hospital-admin/dashboard");
          return;
        }

        await supabase.auth.signOut();
        setErrorMessage("병원 관리자 계정으로 다시 로그인해 주세요.");
      } finally {
        if (mounted) setIsCheckingSession(false);
      }
    }

    void checkSession();
    return () => {
      mounted = false;
    };
  }, [router]);

  async function getSignupRequest(userId: string): Promise<HospitalSignupRequest | null> {
    const { data } = await supabase
      .from("hospital_signup_requests")
      .select("status, rejection_reason")
      .eq("user_id", userId)
      .maybeSingle();

    return data as HospitalSignupRequest | null;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");
    setNoticeMessage("");
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

    const { data: hospitalAdmin } = await supabase
      .from("hospital_admins")
      .select("hospital_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (hospitalAdmin?.hospital_id) {
      router.replace("/hospital-admin/dashboard");
      router.refresh();
      return;
    }

    const request = await getSignupRequest(user.id);
    await supabase.auth.signOut();

    if (request?.status === "pending") {
      setNoticeMessage("병원 가입 신청을 검토 중입니다. 승인 후 이용할 수 있습니다.");
    } else if (request?.status === "rejected") {
      setErrorMessage(
        request.rejection_reason
          ? `병원 가입 신청이 반려되었습니다. 사유: ${request.rejection_reason}`
          : "병원 가입 신청이 반려되었습니다. PAWU 관리자에게 문의해 주세요.",
      );
    } else if (request?.status === "approved") {
      setErrorMessage("승인된 신청이지만 병원 관리자 권한 연결이 완료되지 않았습니다.");
    } else {
      setErrorMessage("등록된 병원 관리자 계정이 아닙니다. 병원 회원가입을 먼저 진행해 주세요.");
    }

    setIsLoading(false);
  }

  if (isCheckingSession) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 px-5 text-slate-950">
        <p className="text-sm text-slate-500">병원 로그인 상태를 확인하고 있습니다...</p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-5 py-10 text-slate-950">
      <div className="w-full max-w-md">
        <header className="mb-8">
          <p className="text-xs font-black tracking-[0.2em] text-emerald-800">PAWU HOSPITAL</p>
          <h1 className="mt-3 text-3xl font-black">병원 전용 로그인</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            승인된 동물병원 관리자 계정으로 로그인해 주세요.
          </p>
        </header>

        <form onSubmit={handleSubmit} className="rounded-3xl border border-slate-300 bg-white p-7 shadow-sm">
          <label htmlFor="username" className="mb-2 block text-sm font-bold">아이디</label>
          <input
            id="username"
            name="username"
            type="text"
            required
            autoComplete="username"
            disabled={isLoading}
            className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-950"
          />

          <label htmlFor="password" className="mb-2 mt-5 block text-sm font-bold">비밀번호</label>
          <input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
            disabled={isLoading}
            className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-950"
          />

          {noticeMessage && (
            <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-700">
              {noticeMessage}
            </div>
          )}

          {errorMessage && (
            <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {errorMessage}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="mt-6 w-full rounded-2xl bg-slate-950 px-5 py-4 font-bold text-white disabled:bg-slate-400"
          >
            {isLoading ? "로그인 처리 중..." : "병원 관리자 로그인"}
          </button>

          <div className="mt-5 text-center text-sm text-slate-500">
            병원 계정이 없나요?{" "}
            <Link href="/auth/hospital-signup" className="font-bold text-slate-950 underline">
              병원 회원가입
            </Link>
          </div>
        </form>
      </div>
    </main>
  );
}
