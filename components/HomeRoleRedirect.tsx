"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function HomeRoleRedirect() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function resolveHome() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.user || !mounted) {
          return;
        }

        const userId = session.user.id;

        const [{ data: superAdmin }, { data: hospitalAdmin }, { data: profile }] =
          await Promise.all([
            supabase
              .from("super_admins")
              .select("user_id")
              .eq("user_id", userId)
              .maybeSingle(),
            supabase
              .from("hospital_admins")
              .select("hospital_id")
              .eq("user_id", userId)
              .maybeSingle(),
            supabase
              .from("profiles")
              .select("account_type")
              .eq("id", userId)
              .maybeSingle(),
          ]);

        if (!mounted) return;

        if (superAdmin?.user_id || profile?.account_type === "super_admin") {
          router.replace("/super-admin/hospitals");
          return;
        }

        if (hospitalAdmin?.hospital_id || profile?.account_type === "hospital") {
          router.replace("/hospital-admin/dashboard");
          return;
        }
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
        <p className="mt-4 text-sm font-semibold text-slate-600">
          계정 화면을 확인하는 중입니다.
        </p>
      </div>
    </div>
  );
}
