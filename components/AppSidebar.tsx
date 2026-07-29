"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

type AccountMode = "guest" | "guardian" | "hospital" | "super_admin";

type MenuItem = {
  href: string;
  label: string;
  icon: string;
};

type HospitalAdminRow = {
  id: number;
  user_id: string;
  hospital_id: number;
  hospitals:
    | {
        id: number;
        name: string;
      }
    | {
        id: number;
        name: string;
      }[]
    | null;
};

const publicMenuItems: MenuItem[] = [
  {
    href: "/",
    label: "홈",
    icon: "🏠",
  },
  {
    href: "/map",
    label: "동물병원 찾기",
    icon: "🏥",
  },
];

const guardianMenuItems: MenuItem[] = [
  {
    href: "/dashboard",
    label: "대시보드",
    icon: "📊",
  },
  {
    href: "/my-reservations",
    label: "내 예약",
    icon: "📅",
  },
  {
    href: "/health-notebook",
    label: "건강수첩",
    icon: "📖",
  },
  {
    href: "/pets",
    label: "반려동물",
    icon: "🐾",
  },
  {
    href: "/account",
    label: "계정",
    icon: "👤",
  },
];

const superAdminMenuItems: MenuItem[] = [
  {
    href: "/admin",
    label: "관리자 대시보드",
    icon: "📊",
  },
  {
    href: "/super-admin/hospitals",
    label: "병원 가입 승인",
    icon: "✅",
  },
  {
    href: "/admin/hospitals",
    label: "병원 관리",
    icon: "🏥",
  },
  {
    href: "/admin/reservations",
    label: "예약 관리",
    icon: "📅",
  },
  {
    href: "/admin/users",
    label: "회원 관리",
    icon: "👤",
  },
  {
    href: "/admin/reviews",
    label: "리뷰 관리",
    icon: "⭐",
  },
  {
    href: "/admin/settings",
    label: "설정",
    icon: "⚙️",
  },
];

const hospitalMenuItems: MenuItem[] = [
  {
    href: "/hospital-admin",
    label: "병원 대시보드",
    icon: "🏥",
  },
  {
    href: "/hospital-admin/profile",
    label: "병원 정보 관리",
    icon: "✏️",
  },
  {
    href: "/hospital-admin/patients",
    label: "환자 관리",
    icon: "🩺",
  },
  {
    href: "/admin",
    label: "예약 관리",
    icon: "📋",
  },
  {
    href: "/hospital-admin/calendar",
    label: "예약 달력",
    icon: "📅",
  },
  {
    href: "/hospital-admin/business-hours",
    label: "운영시간 관리",
    icon: "🕒",
  },
  {
    href: "/hospital-admin/time-blocks",
    label: "예약시간 열기·닫기",
    icon: "⏱️",
  },
];

function isActivePath(pathname: string, href: string) {
  if (
    href === "/" ||
    href === "/admin" ||
    href === "/hospital-admin"
  ) {
    return pathname === href;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

function getHospitalName(admin: HospitalAdminRow | null) {
  if (!admin?.hospitals) return null;

  if (Array.isArray(admin.hospitals)) {
    return admin.hospitals[0]?.name ?? null;
  }

  return admin.hospitals.name;
}

type SidebarContentProps = {
  user: User | null;
  accountMode: AccountMode;
  hospitalAdmin: HospitalAdminRow | null;
  pathname: string;
  isLoggingOut: boolean;
  onNavigate?: () => void;
  onLogout: () => void;
};

function SidebarContent({
  user,
  accountMode,
  hospitalAdmin,
  pathname,
  isLoggingOut,
  onNavigate,
  onLogout,
}: SidebarContentProps) {
  function renderMenuItem(item: MenuItem) {
    const isActive = isActivePath(pathname, item.href);

    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={onNavigate}
        className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition ${
          isActive
            ? "bg-black text-white"
            : "text-gray-700 hover:bg-gray-100"
        }`}
      >
        <span
          className={`flex h-9 w-9 items-center justify-center rounded-xl text-lg ${
            isActive ? "bg-white/15" : "bg-gray-100"
          }`}
          aria-hidden="true"
        >
          {item.icon}
        </span>

        <span>{item.label}</span>
      </Link>
    );
  }

  const hospitalName = getHospitalName(hospitalAdmin);

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-gray-200 px-5 py-6">
        <Link href="/" onClick={onNavigate} className="block">
          <p className="text-3xl font-black tracking-tight">PAWU</p>
          <p className="mt-1 text-xs text-gray-500">Always with us.</p>
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto px-4 py-5">
        {accountMode !== "hospital" &&
          accountMode !== "super_admin" && (
          <>
            <p className="px-3 text-xs font-bold uppercase tracking-wider text-gray-400">
              기본 메뉴
            </p>

            <div className="mt-3 space-y-1">
              {publicMenuItems.map(renderMenuItem)}
            </div>
          </>
        )}

        {accountMode === "guardian" && (
          <>
            <div className="my-5 border-t border-gray-200" />

            <p className="px-3 text-xs font-bold uppercase tracking-wider text-gray-400">
              보호자 메뉴
            </p>

            <div className="mt-3 space-y-1">
              {guardianMenuItems.map(renderMenuItem)}
            </div>
          </>
        )}

        {accountMode === "hospital" && (
          <>
            <p className="px-3 text-xs font-bold uppercase tracking-wider text-gray-400">
              병원 관리자 메뉴
            </p>

            <div className="mt-3 space-y-1">
              {hospitalMenuItems.map(renderMenuItem)}
            </div>
          </>
        )}

        {accountMode === "super_admin" && (
          <>
            <p className="px-3 text-xs font-bold uppercase tracking-wider text-gray-400">
              최고관리자 메뉴
            </p>

            <div className="mt-3 space-y-1">
              {superAdminMenuItems.map(renderMenuItem)}
            </div>
          </>
        )}

        {accountMode === "guest" && (
          <>
            <div className="my-5 border-t border-gray-200" />

            <p className="px-3 text-xs font-bold uppercase tracking-wider text-gray-400">
              계정
            </p>

            <div className="mt-3 space-y-1">
              {renderMenuItem({
                href: "/auth/login",
                label: "로그인",
                icon: "🔑",
              })}
              {renderMenuItem({
                href: "/auth/signup",
                label: "회원가입",
                icon: "✍️",
              })}
            </div>
          </>
        )}
      </nav>

      <div className="border-t border-gray-200 p-4">
        {user ? (
          <>
            <div className="rounded-2xl bg-gray-50 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-gray-400">
                  {accountMode === "super_admin"
                    ? "최고관리자 계정"
                    : accountMode === "hospital"
                      ? "병원 관리자 계정"
                      : "보호자 계정"}
                </p>

                <span
                  className={`rounded-full px-2 py-1 text-[10px] font-bold ${
                    accountMode === "super_admin"
                      ? "bg-purple-100 text-purple-700"
                      : accountMode === "hospital"
                        ? "bg-blue-100 text-blue-700"
                        : "bg-green-100 text-green-700"
                  }`}
                >
                  {accountMode === "super_admin"
                    ? "SUPER ADMIN"
                    : accountMode === "hospital"
                      ? "HOSPITAL"
                      : "GUARDIAN"}
                </span>
              </div>

              {accountMode === "hospital" && hospitalName && (
                <p className="mt-2 truncate text-sm font-bold">
                  {hospitalName}
                </p>
              )}

              <p className="mt-1 truncate text-xs text-gray-500">
                {user.email ?? "이메일 정보 없음"}
              </p>
            </div>

            <button
              type="button"
              onClick={onLogout}
              disabled={isLoggingOut}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-red-200 px-4 py-3 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400"
            >
              <span aria-hidden="true">🚪</span>
              {isLoggingOut ? "로그아웃 중..." : "로그아웃"}
            </button>
          </>
        ) : (
          <Link
            href="/auth/login"
            onClick={onNavigate}
            className="block rounded-2xl bg-black px-4 py-3 text-center text-sm font-semibold text-white"
          >
            로그인
          </Link>
        )}
      </div>
    </div>
  );
}

export default function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [accountMode, setAccountMode] =
    useState<AccountMode>("guest");
  const [hospitalAdmin, setHospitalAdmin] =
    useState<HospitalAdminRow | null>(null);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function resolveAccountMode(currentUser: User | null) {
      if (!currentUser) {
        if (!isMounted) return;

        setUser(null);
        setHospitalAdmin(null);
        setAccountMode("guest");
        return;
      }

      const { data: superAdmin, error: superAdminError } =
        await supabase
          .from("super_admins")
          .select("user_id")
          .eq("user_id", currentUser.id)
          .maybeSingle();

      if (!isMounted) return;

      if (superAdminError) {
        console.warn(
          "최고관리자 권한 조회 오류:",
          superAdminError.message,
        );
      }

      if (superAdmin?.user_id) {
        setUser(currentUser);
        setHospitalAdmin(null);
        setAccountMode("super_admin");
        return;
      }

      const { data: profile, error: profileError } =
        await supabase
          .from("profiles")
          .select("account_type")
          .eq("id", currentUser.id)
          .maybeSingle();

      if (!isMounted) return;

      if (profileError) {
        console.warn(
          "계정 유형 조회 오류:",
          profileError.message,
        );
      }

      const { data, error } = await supabase
        .from("hospital_admins")
        .select(
          `
            id,
            user_id,
            hospital_id,
            hospitals (
              id,
              name
            )
          `,
        )
        .eq("user_id", currentUser.id)
        .maybeSingle();

      if (!isMounted) return;

      if (error) {
        console.error("병원 관리자 권한 조회 오류:", error);
        setUser(currentUser);
        setHospitalAdmin(null);
        setAccountMode("guardian");
        return;
      }

      setUser(currentUser);

      if (data) {
        setHospitalAdmin(data as unknown as HospitalAdminRow);
        setAccountMode("hospital");
        return;
      }

      setHospitalAdmin(null);

      if (profile?.account_type === "guardian") {
        setAccountMode("guardian");
        return;
      }

      setAccountMode("guest");
    }

    async function loadUser() {
      const {
  data: { session },
  error,
} = await supabase.auth.getSession();

if (error) {
  console.warn(
    "사이드바 로그인 정보 조회 실패:",
    error.message,
  );
  return;
}

const user = session?.user ?? null;

if (!user) {
  setUser(null);
  return;
}

      await resolveAccountMode(user);
    }

    loadUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      void resolveAccountMode(session?.user ?? null);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    setIsMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!isMobileOpen) {
      document.body.style.overflow = "";
      return;
    }

    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = "";
    };
  }, [isMobileOpen]);

  async function handleLogout() {
    setIsLoggingOut(true);

    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error("로그아웃 오류:", error);
      window.alert("로그아웃하지 못했습니다. 다시 시도해 주세요.");
      setIsLoggingOut(false);
      return;
    }

    setUser(null);
    setHospitalAdmin(null);
    setAccountMode("guest");
    setIsMobileOpen(false);
    setIsLoggingOut(false);

    router.replace("/");
    router.refresh();
  }

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-gray-200 bg-white lg:block">
        <SidebarContent
          user={user}
          accountMode={accountMode}
          hospitalAdmin={hospitalAdmin}
          pathname={pathname}
          isLoggingOut={isLoggingOut}
          onLogout={handleLogout}
        />
      </aside>

      <header className="fixed inset-x-0 top-0 z-30 flex h-16 items-center justify-between border-b border-gray-200 bg-white px-4 lg:hidden">
        <Link href="/" className="text-xl font-black tracking-tight">
          PAWU
        </Link>

        <button
          type="button"
          onClick={() => setIsMobileOpen(true)}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-gray-300 bg-white text-xl"
          aria-label="메뉴 열기"
        >
          ☰
        </button>
      </header>

      {isMobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            onClick={() => setIsMobileOpen(false)}
            className="absolute inset-0 bg-black/40"
            aria-label="메뉴 닫기"
          />

          <aside className="absolute inset-y-0 left-0 w-[85%] max-w-72 bg-white shadow-2xl">
            <button
              type="button"
              onClick={() => setIsMobileOpen(false)}
              className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-xl border border-gray-300 bg-white"
              aria-label="메뉴 닫기"
            >
              ✕
            </button>

            <SidebarContent
              user={user}
              accountMode={accountMode}
              hospitalAdmin={hospitalAdmin}
              pathname={pathname}
              isLoggingOut={isLoggingOut}
              onNavigate={() => setIsMobileOpen(false)}
              onLogout={handleLogout}
            />
          </aside>
        </div>
      )}
    </>
  );
}