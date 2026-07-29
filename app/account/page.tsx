"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../../lib/supabase";

type MenuItem = {
  href: string;
  icon: string;
  title: string;
  description: string;
};

const menuItems: MenuItem[] = [
  {
    href: "/dashboard",
    icon: "🏠",
    title: "건강 대시보드",
    description: "예약, 투약, 예방접종 일정을 한눈에 확인합니다.",
  },
  {
    href: "/my-reservations",
    icon: "📅",
    title: "내 예약",
    description: "예약 상태와 완료된 진료기록을 확인합니다.",
  },
  {
    href: "/inpatient-updates",
    icon: "🏥",
    title: "입원 경과",
    description: "병원에서 보호자에게 공유한 식사, 투약, 처치와 회복 소식을 확인합니다.",
  },
  {
    href: "/health-notebook",
    icon: "📖",
    title: "건강수첩",
    description: "진료, 처방약, 예방접종과 몸무게를 관리합니다.",
  },
  {
    href: "/pets",
    icon: "🐾",
    title: "반려동물 관리",
    description: "등록된 반려동물의 기본 정보를 관리합니다.",
  },
  {
    href: "/map",
    icon: "🏥",
    title: "동물병원 찾기",
    description: "가까운 동물병원을 찾아 예약합니다.",
  },
];

export default function AccountPage() {
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadSession() {
      try {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (!isMounted) {
          return;
        }

        if (error) {
          console.error("로그인 세션 조회 오류:", error);
          setErrorMessage("로그인 상태를 확인하지 못했습니다.");
          setUser(null);
          return;
        }

        setUser(session?.user ?? null);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        console.error("로그인 세션 확인 중 오류:", error);
        setErrorMessage("로그인 상태를 확인하지 못했습니다.");
        setUser(null);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isMounted) {
        return;
      }

      setUser(session?.user ?? null);
      setIsLoading(false);
      setErrorMessage("");
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  async function handleLogout() {
    setIsLoggingOut(true);
    setErrorMessage("");

    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error("로그아웃 오류:", error);
      setErrorMessage("로그아웃하지 못했습니다. 다시 시도해 주세요.");
      setIsLoggingOut(false);
      return;
    }

    router.replace("/auth/login");
    router.refresh();
  }

  if (isLoading) {
    return (
      <main className="min-h-screen bg-gray-50 px-5 py-8 text-black">
        <p className="text-center text-sm text-gray-500">
          계정 정보를 확인하는 중입니다.
        </p>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="min-h-screen bg-gray-50 px-5 py-8 text-black">
        <div className="mx-auto w-full max-w-md">
          <section className="mt-20 rounded-3xl border border-gray-200 bg-white p-8 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100 text-3xl">
              🔐
            </div>

            <h1 className="mt-5 text-2xl font-bold">로그인이 필요합니다</h1>

            <p className="mt-3 text-sm leading-6 text-gray-500">
              계정과 반려동물 건강정보를 확인하려면 로그인해 주세요.
            </p>

            <Link
              href="/auth/login"
              className="mt-8 block rounded-2xl bg-black px-5 py-4 font-semibold text-white"
            >
              로그인하기
            </Link>

            <Link
              href="/"
              className="mt-3 block rounded-2xl border border-gray-300 px-5 py-4 font-medium"
            >
              PAWU 홈으로
            </Link>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 px-5 py-8 text-black">
      <div className="mx-auto w-full max-w-3xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/dashboard"
            className="inline-block rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm"
          >
            ← 대시보드
          </Link>

          <Link
            href="/"
            className="inline-block rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm"
          >
            PAWU 홈
          </Link>
        </div>

        <header className="mt-8">
          <p className="text-sm text-gray-500">PAWU 계정</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">계정 관리</h1>
          <p className="mt-3 text-sm leading-6 text-gray-600">
            계정 정보와 보호자용 주요 메뉴를 관리합니다.
          </p>
        </header>

        {errorMessage && (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
            {errorMessage}
          </div>
        )}

        <section className="mt-8 rounded-3xl border border-gray-200 bg-white p-6">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-black text-3xl text-white">
              👤
            </div>

            <div className="min-w-0">
              <p className="text-sm text-gray-500">로그인 계정</p>
              <p className="mt-1 break-all text-xl font-bold">
                {user.email ?? "이메일 정보 없음"}
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl bg-gray-50 p-4">
              <p className="text-xs text-gray-500">계정 ID</p>
              <p className="mt-2 truncate text-sm font-medium">{user.id}</p>
            </div>

            <div className="rounded-2xl bg-gray-50 p-4">
              <p className="text-xs text-gray-500">최근 로그인</p>
              <p className="mt-2 text-sm font-medium">
                {user.last_sign_in_at
                  ? new Date(user.last_sign_in_at).toLocaleString("ko-KR")
                  : "확인할 수 없음"}
              </p>
            </div>
          </div>
        </section>

        <section className="mt-6">
          <h2 className="text-xl font-bold">보호자 메뉴</h2>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {menuItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-3xl border border-gray-200 bg-white p-5 transition hover:-translate-y-0.5 hover:border-black"
              >
                <span className="text-3xl">{item.icon}</span>

                <h3 className="mt-4 text-lg font-bold">{item.title}</h3>

                <p className="mt-2 text-sm leading-6 text-gray-500">
                  {item.description}
                </p>

                <p className="mt-4 text-sm font-semibold">열기 →</p>
              </Link>
            ))}
          </div>
        </section>

        <section className="mt-6 rounded-3xl border border-red-200 bg-white p-6">
          <h2 className="text-lg font-bold">로그아웃</h2>

          <p className="mt-2 text-sm leading-6 text-gray-500">
            현재 기기에서 PAWU 계정 사용을 종료합니다.
          </p>

          <button
            type="button"
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="mt-5 w-full rounded-2xl border border-red-300 px-5 py-4 font-semibold text-red-600 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400"
          >
            {isLoggingOut ? "로그아웃 중..." : "로그아웃"}
          </button>
        </section>
      </div>
    </main>
  );
}