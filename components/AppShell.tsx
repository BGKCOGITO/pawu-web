"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import GuardianBottomNav from "./GuardianBottomNav";
import GuardianTopBar from "./GuardianTopBar";
import RoutePrefetcher from "./navigation/RoutePrefetcher";
import NetworkStatusBanner from "./system/NetworkStatusBanner";

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  const isHospitalAdmin = pathname.startsWith("/hospital-admin");
  const isSuperAdmin = pathname.startsWith("/super-admin");
  const isMasterAdmin = pathname.startsWith("/admin");
  const isAuth = pathname.startsWith("/auth");
  const isMap = pathname.startsWith("/map");

  /*
   * 관리자 영역은 각 영역의 전용 layout이 전체 화면을 담당합니다.
   * 최상위 Shell에서 메뉴를 추가하면 병원 사이드바가 이중으로 표시됩니다.
   */
  if (isHospitalAdmin || isSuperAdmin || isMasterAdmin) {
    return <><RoutePrefetcher /><NetworkStatusBanner />{children}</>;
  }

  if (isAuth) {
    return <><RoutePrefetcher /><NetworkStatusBanner /><div className="min-h-screen bg-[#f4f0e8]">{children}</div></>;
  }

  if (isMap) {
    return (
      <div className="min-h-screen bg-[#f4f0e8] text-[#19332d]">
        <RoutePrefetcher />
        <NetworkStatusBanner />
        {children}
        <GuardianBottomNav />
      </div>
    );
  }

  return (
    <div className="guardian-app-shell">
      <RoutePrefetcher />
      <NetworkStatusBanner />
      <div className="guardian-app-frame">
        <GuardianTopBar />
        <div className="guardian-page-content">{children}</div>
      </div>
      <GuardianBottomNav />
    </div>
  );
}
