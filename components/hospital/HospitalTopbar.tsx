"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";

const pageNames: Array<[string, string, string]> = [
  ["/hospital-admin/dashboard", "대시보드", "병원 운영 현황"],
  ["/hospital-admin/workflow-v6-2", "오늘의 업무", "예약·접수·진료 흐름"],
  ["/hospital-admin/reservations", "예약 관리", "예약 요청과 진료 준비 자료"],
  ["/hospital-admin/calendar", "예약·캘린더", "병원 일정과 예약"],
  ["/hospital-admin/patients", "환자 관리", "환자 정보와 진료 이력"],
  ["/hospital-admin/emr", "전자차트", "진료 기록 작성"],
  ["/hospital-admin/medical-records", "진료 기록", "전체 진료 이력"],
  ["/hospital-admin/prescriptions", "처방 관리", "처방 오더와 복약 안내"],
  ["/hospital-admin/lab", "검사·영상", "검사 결과와 영상 기록"],
  ["/hospital-admin/inventory", "재고 관리", "입출고와 사용 기록"],
  ["/hospital-admin/medications", "약품 관리", "병원 약품 마스터"],
  ["/hospital-admin/billing", "청구·결제", "진료비와 결제"],
  ["/hospital-admin/staff", "직원 관리", "직원과 권한"],
  ["/hospital-admin/analytics", "운영 분석", "병원 운영 통계"],
  ["/hospital-admin/chat", "보호자 채팅", "보호자 상담"],
  ["/hospital-admin/audit-logs", "감사 로그", "주요 변경 기록"],
  ["/hospital-admin/settings", "병원 설정", "병원 프로그램 설정"],
];

function resolvePage(pathname: string) {
  if (pathname === "/hospital-admin") {
    return { title: "대시보드", description: "병원 운영 현황" };
  }

  const matched = pageNames
    .filter(([path]) => pathname === path || pathname.startsWith(`${path}/`))
    .sort((a, b) => b[0].length - a[0].length)[0];

  return matched
    ? { title: matched[1], description: matched[2] }
    : { title: "병원 관리자", description: "PAWU Hospital Desktop" };
}

export default function HospitalTopbar({
  sidebarCollapsed,
  onOpenMobile,
  onToggleSidebar,
}: {
  sidebarCollapsed: boolean;
  onOpenMobile: () => void;
  onToggleSidebar: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [hospitalName, setHospitalName] = useState("병원 확인 중");
  const [userName, setUserName] = useState("사용자");
  const [menuOpen, setMenuOpen] = useState(false);

  const page = useMemo(() => resolvePage(pathname), [pathname]);

  useEffect(() => {
    let active = true;

    async function load() {
      const { data: auth } = await supabase.auth.getUser();
      if (!active || !auth.user) return;

      setUserName(
        String(
          auth.user.user_metadata?.name ??
            auth.user.user_metadata?.full_name ??
            auth.user.email?.split("@")[0] ??
            "사용자",
        ),
      );

      let hospitalId: number | null = null;

      const { data: staff } = await supabase
        .from("hospital_staff")
        .select("hospital_id")
        .eq("user_id", auth.user.id)
        .eq("is_active", true)
        .maybeSingle();

      if (staff?.hospital_id) {
        hospitalId = Number(staff.hospital_id);
      }

      if (!hospitalId) {
        const { data: admin } = await supabase
          .from("hospital_admins")
          .select("hospital_id")
          .eq("user_id", auth.user.id)
          .maybeSingle();

        if (admin?.hospital_id) {
          hospitalId = Number(admin.hospital_id);
        }
      }

      if (!hospitalId) {
        if (active) setHospitalName("병원 연결 정보 없음");
        return;
      }

      const { data: hospital } = await supabase
        .from("hospitals")
        .select("name")
        .eq("id", hospitalId)
        .maybeSingle();

      if (active && hospital?.name) {
        setHospitalName(String(hospital.name));
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, []);

  async function logout() {
    await supabase.auth.signOut();
    router.push("/auth/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-30 border-b border-slate-300 bg-white/95 backdrop-blur">
      <div className="flex h-16 items-center justify-between gap-4 px-3 sm:px-5">
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            onClick={onOpenMobile}
            aria-label="모바일 메뉴 열기"
            className="flex h-9 w-9 items-center justify-center border border-slate-300 bg-white text-lg font-bold lg:hidden"
          >
            ≡
          </button>

          <button
            type="button"
            onClick={onToggleSidebar}
            aria-label={sidebarCollapsed ? "사이드바 펼치기" : "사이드바 접기"}
            className="hidden h-9 w-9 items-center justify-center border border-slate-300 bg-white text-sm font-black text-slate-700 hover:bg-slate-50 lg:flex"
          >
            {sidebarCollapsed ? "›" : "‹"}
          </button>

          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-500">
              <Link
                href="/hospital-admin/dashboard"
                className="truncate hover:text-slate-900"
              >
                {hospitalName}
              </Link>
              <span>/</span>
              <span className="truncate">{page.title}</span>
            </div>
            <div className="mt-0.5 flex min-w-0 items-baseline gap-3">
              <h1 className="truncate text-base font-bold text-slate-950 sm:text-lg">
                {page.title}
              </h1>
              <p className="hidden truncate text-xs text-slate-500 md:block">
                {page.description}
              </p>
            </div>
          </div>
        </div>

        <div className="relative flex shrink-0 items-center gap-2">
          <span className="hidden text-xs text-slate-500 xl:inline">
            {new Intl.DateTimeFormat("ko-KR", {
              year: "numeric",
              month: "2-digit",
              day: "2-digit",
              weekday: "short",
            }).format(new Date())}
          </span>

          <button
            type="button"
            onClick={() => setMenuOpen((value) => !value)}
            className="flex h-10 items-center gap-3 border border-slate-300 bg-white px-3 text-left hover:bg-slate-50"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">
              {userName.slice(0, 1).toUpperCase()}
            </span>
            <span className="hidden max-w-32 truncate text-xs font-bold text-slate-800 sm:block">
              {userName}
            </span>
            <span className="text-[10px] text-slate-500">▼</span>
          </button>

          {menuOpen && (
            <>
              <button
                type="button"
                aria-label="사용자 메뉴 닫기"
                onClick={() => setMenuOpen(false)}
                className="fixed inset-0 z-40 cursor-default"
              />
              <div className="absolute right-0 top-12 z-50 w-52 border border-slate-300 bg-white p-2 shadow-xl">
                <div className="border-b border-slate-200 px-3 py-2">
                  <p className="truncate text-xs font-bold text-slate-900">
                    {userName}
                  </p>
                  <p className="mt-1 truncate text-[10px] text-slate-500">
                    {hospitalName}
                  </p>
                </div>
                <Link
                  href="/hospital-admin/profile"
                  onClick={() => setMenuOpen(false)}
                  className="mt-2 block px-3 py-2 text-xs font-semibold hover:bg-slate-100"
                >
                  내 정보
                </Link>
                <Link
                  href="/hospital-admin/settings"
                  onClick={() => setMenuOpen(false)}
                  className="block px-3 py-2 text-xs font-semibold hover:bg-slate-100"
                >
                  병원 설정
                </Link>
                <button
                  type="button"
                  onClick={() => void logout()}
                  className="block w-full px-3 py-2 text-left text-xs font-semibold text-red-700 hover:bg-red-50"
                >
                  로그아웃
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
