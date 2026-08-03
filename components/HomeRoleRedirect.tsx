"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getCachedSession } from "@/lib/client-auth-session-cache";

const ROLE_CACHE_TTL_MS = 5 * 60_000;

type HomeRole = "guardian" | "hospital" | "super_admin";

function readRoleCache(userId: string): HomeRole | null {
  try {
    const raw = sessionStorage.getItem(`pawu-home-role-v981:${userId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { role?: HomeRole; savedAt?: number };
    if (!parsed.role || !parsed.savedAt || Date.now() - parsed.savedAt > ROLE_CACHE_TTL_MS) {
      sessionStorage.removeItem(`pawu-home-role-v981:${userId}`);
      return null;
    }
    return parsed.role;
  } catch {
    return null;
  }
}

function writeRoleCache(userId: string, role: HomeRole) {
  try {
    sessionStorage.setItem(
      `pawu-home-role-v981:${userId}`,
      JSON.stringify({ role, savedAt: Date.now() }),
    );
  } catch {
    // 세션 캐시 저장 실패는 경로 확인을 막지 않습니다.
  }
}

export default function HomeRoleRedirect() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function resolveHome() {
      try {
        const session = await getCachedSession();

        if (!session?.user || !mounted) return;

        const userId = session.user.id;
        const cachedRole = readRoleCache(userId);

        if (cachedRole === "super_admin") {
          router.replace("/super-admin/hospitals");
          return;
        }
        if (cachedRole === "hospital") {
          router.replace("/hospital-admin/dashboard");
          return;
        }
        if (cachedRole === "guardian") return;

        const [{ data: superAdmin }, { data: hospitalAdmin }, { data: profile }] =
          await Promise.all([
            supabase.from("super_admins").select("user_id").eq("user_id", userId).maybeSingle(),
            supabase.from("hospital_admins").select("hospital_id").eq("user_id", userId).maybeSingle(),
            supabase.from("profiles").select("account_type").eq("id", userId).maybeSingle(),
          ]);

        if (!mounted) return;

        if (superAdmin?.user_id || profile?.account_type === "super_admin") {
          writeRoleCache(userId, "super_admin");
          router.replace("/super-admin/hospitals");
          return;
        }

        if (hospitalAdmin?.hospital_id || profile?.account_type === "hospital") {
          writeRoleCache(userId, "hospital");
          router.replace("/hospital-admin/dashboard");
          return;
        }

        writeRoleCache(userId, "guardian");
      } catch (error) {
        console.warn("홈 계정 경로 확인 오류:", error);
      } finally {
        if (mounted) setChecking(false);
      }
    }

    void resolveHome();

    return () => {
      mounted = false;
    };
  }, [router]);

  if (!checking) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-white">
      <div className="text-center">
        <div className="mx-auto h-9 w-9 animate-spin rounded-full border-4 border-slate-200 border-t-slate-950" />
        <p className="mt-4 text-sm font-semibold text-slate-600">계정 화면을 확인하는 중입니다.</p>
      </div>
    </div>
  );
}
