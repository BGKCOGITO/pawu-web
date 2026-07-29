"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function SocialProfilePage() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/auth/login");
        return;
      }

      setEmail(
        user.user_metadata?.email_is_synthetic
          ? user.user_metadata?.provider === "naver"
            ? "네이버 계정 · 이메일 미제공"
            : "카카오 계정 · 이메일 미제공"
          : user.email ?? "",
      );

      const { data } = await supabase
        .from("profiles")
        .select("display_name,phone")
        .eq("id", user.id)
        .maybeSingle();

      setDisplayName(
        String(
          data?.display_name ??
            user.user_metadata?.full_name ??
            user.user_metadata?.name ??
            user.user_metadata?.nickname ??
            "",
        ),
      );
      setPhone(String(data?.phone ?? user.phone ?? ""));
      setLoading(false);
    }

    void load();
  }, [router]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error("로그인 정보가 만료되었습니다.");
      }

      const response = await fetch("/api/auth/social/profile", {
        method: "PATCH",
        headers: {
          authorization: `Bearer ${session.access_token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          displayName,
          phone,
        }),
      });

      const result = (await response.json()) as {
        ok?: boolean;
        message?: string;
        redirectPath?: string;
      };

      if (!response.ok || !result.ok) {
        throw new Error(result.message ?? "프로필 저장에 실패했습니다.");
      }

      window.location.replace(result.redirectPath ?? "/");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "프로필 저장에 실패했습니다.",
      );
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f4f0e8]">
        <p className="text-sm text-slate-500">회원 정보를 확인하는 중입니다.</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f4f0e8] px-5 py-10 text-[#173e35]">
      <section className="mx-auto w-full max-w-md rounded-[32px] bg-white p-7 shadow-sm">
        <p className="text-xs font-bold tracking-[0.18em] text-slate-400">
          PAWU PROFILE
        </p>
        <h1 className="mt-2 text-2xl font-bold">처음 한 번만 입력해 주세요</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          예약자 정보와 병원 연락을 위해 이름과 휴대폰 번호가 필요합니다.
        </p>

        <form onSubmit={submit} className="mt-7 space-y-5">
          <label className="block">
            <span className="text-sm font-bold">이메일</span>
            <input
              value={email}
              disabled
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-100 px-4 py-3 text-slate-500"
            />
          </label>

          <label className="block">
            <span className="text-sm font-bold">이름</span>
            <input
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              required
              minLength={2}
              className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none focus:border-[#173e35]"
            />
          </label>

          <label className="block">
            <span className="text-sm font-bold">휴대폰 번호</span>
            <input
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              required
              inputMode="numeric"
              placeholder="01012345678"
              className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none focus:border-[#173e35]"
            />
          </label>

          {message && (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {message}
            </div>
          )}

          <button
            disabled={saving}
            className="w-full rounded-2xl bg-[#173e35] px-5 py-4 font-bold text-white disabled:opacity-50"
          >
            {saving ? "저장 중..." : "PAWU 시작하기"}
          </button>
        </form>
      </section>
    </main>
  );
}
