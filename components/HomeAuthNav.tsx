"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

type Mode = "loading" | "guest" | "guardian" | "hospital" | "super_admin";

function AccountIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c.8-4 3.1-6 7-6s6.2 2 7 6" />
    </svg>
  );
}

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
      if (!currentUser) { setUser(null); setMode("guest"); return; }
      setUser(currentUser);
      const [{ data: superAdmin }, { data: hospitalAdmin }, { data: profile }] = await Promise.all([
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
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => void resolveAccount(session?.user ?? null));
    function closeOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", closeOutside);
    return () => { mounted = false; listener.subscription.unsubscribe(); document.removeEventListener("mousedown", closeOutside); };
  }, []);

  async function handleLogout() {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    const { error } = await supabase.auth.signOut();
    if (error) { window.alert("로그아웃하지 못했습니다."); setIsLoggingOut(false); return; }
    setOpen(false); setUser(null); setMode("guest"); setIsLoggingOut(false); router.push("/"); router.refresh();
  }

  if (mode === "loading") return <div className="v903-account-skeleton" aria-hidden="true" />;

  if (!user || mode === "guest") {
    return (
      <nav className="v903-auth-nav" aria-label="회원 메뉴">
        <Link href="/auth/login" className="v903-login">로그인</Link>
        <Link href="/auth/signup" className="v903-signup"><span className="v903-signup-full">회원가입</span><span className="v903-signup-short">가입</span></Link>
      </nav>
    );
  }

  const accountHref = mode === "super_admin" ? "/admin" : mode === "hospital" ? "/hospital-admin" : "/account";
  const accountLabel = mode === "super_admin" ? "관리자" : mode === "hospital" ? "병원 관리자" : "내 계정";

  return (
    <div ref={menuRef} className="v903-account-wrap">
      <button type="button" aria-label="계정 메뉴 열기" aria-expanded={open} onClick={() => setOpen((value) => !value)} className="v903-account-button"><AccountIcon /></button>
      {open && (
        <div className="v903-account-menu">
          <Link href={accountHref} onClick={() => setOpen(false)}>{accountLabel}</Link>
          <button type="button" onClick={handleLogout} disabled={isLoggingOut}>{isLoggingOut ? "로그아웃 중" : "로그아웃"}</button>
        </div>
      )}
    </div>
  );
}
