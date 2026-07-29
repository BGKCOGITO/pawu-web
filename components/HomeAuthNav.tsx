"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

type Mode = "loading" | "guest" | "guardian" | "hospital" | "super_admin";

export default function HomeAuthNav() {
  const router = useRouter();
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [mode, setMode] = useState<Mode>("loading");
  const [open, setOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function resolveAccount(currentUser: User | null) {
      if (!mounted) return;
      if (!currentUser) {
        setUser(null);
        setMode("guest");
        return;
      }
      setUser(currentUser);

      const [{ data: superAdmin }, { data: hospitalAdmin }, { data: profile }] =
        await Promise.all([
          supabase.from("super_admins").select("user_id").eq("user_id", currentUser.id).maybeSingle(),
          supabase.from("hospital_admins").select("hospital_id").eq("user_id", currentUser.id).maybeSingle(),
          supabase.from("profiles").select("account_type").eq("id", currentUser.id).maybeSingle(),
        ]);

      if (!mounted) return;
      if (superAdmin?.user_id || profile?.account_type === "super_admin") setMode("super_admin");
      else if (hospitalAdmin?.hospital_id || profile?.account_type === "hospital") setMode("hospital");
      else setMode("guardian");
    }

    void supabase.auth.getSession().then(({ data }) => resolveAccount(data.session?.user ?? null));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      void resolveAccount(session?.user ?? null);
    });

    function closeOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", closeOutside);

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
      document.removeEventListener("mousedown", closeOutside);
    };
  }, []);

  async function handleLogout() {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    const { error } = await supabase.auth.signOut();
    if (error) {
      window.alert("로그아웃하지 못했습니다.");
      setIsLoggingOut(false);
      return;
    }
    setOpen(false);
    setUser(null);
    setMode("guest");
    setIsLoggingOut(false);
    router.push("/");
    router.refresh();
  }

  if (mode === "loading") return <div className="h-11 w-11 animate-pulse rounded-full bg-neutral-100" />;

  if (!user || mode === "guest") {
    return (
      <nav className="flex items-center gap-2">
        <Link href="/auth/login" className="rounded-full px-3 py-2 text-sm font-semibold text-neutral-600">로그인</Link>
        <Link href="/auth/signup" className="rounded-full bg-[#183d35] px-4 py-2.5 text-sm font-bold text-white">회원가입</Link>
      </nav>
    );
  }

  const accountHref = mode === "super_admin" ? "/admin" : mode === "hospital" ? "/hospital-admin" : "/account";
  const accountLabel = mode === "super_admin" ? "관리자" : mode === "hospital" ? "병원 관리자" : "내 계정";

  return (
    <div ref={menuRef} className="relative justify-self-end">
      <button
        type="button"
        aria-label="계정 메뉴 열기"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex h-11 w-11 items-center justify-center rounded-full bg-[#183d35] text-lg font-black text-white shadow-sm transition active:scale-95"
      >
        •
      </button>
      {open && (
        <div className="absolute right-0 top-14 z-[80] w-44 overflow-hidden rounded-2xl border border-[#e8e3d8] bg-[#fffdf8] p-2 shadow-2xl">
          <Link
            href={accountHref}
            onClick={() => setOpen(false)}
            className="block rounded-xl px-4 py-3 text-sm font-extrabold text-[#183d35] hover:bg-[#f1eee6]"
          >
            {accountLabel}
          </Link>
          <div className="my-1 h-px bg-[#ebe6da]" />
          <button
            type="button"
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="block w-full rounded-xl px-4 py-3 text-left text-sm font-extrabold text-[#d45747] hover:bg-[#fff0ec] disabled:opacity-50"
          >
            {isLoggingOut ? "로그아웃 중" : "로그아웃"}
          </button>
        </div>
      )}
    </div>
  );
}
