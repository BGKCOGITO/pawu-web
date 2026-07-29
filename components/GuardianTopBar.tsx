"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import HomeAuthNav from "./HomeAuthNav";

const labels: Record<string, string> = {
  "/": "오늘의 PAWU",
  "/dashboard": "오늘의 PAWU",
  "/pets": "우리 아이들",
  "/my-reservations": "예약 관리",
  "/health-notebook": "건강 기록",
  "/account": "내 정보",
};

export default function GuardianTopBar() {
  const pathname = usePathname();
  if (pathname.startsWith("/map")) return null;

  const title = Object.entries(labels).find(([path]) => pathname === path || (path !== "/" && pathname.startsWith(path)))?.[1] ?? "PAWU";

  return (
    <header className="guardian-topbar">
      <Link href="/" className="guardian-brand" aria-label="PAWU 홈">
        <span className="guardian-brand-mark"><Image src="/pawu-symbol.png" alt="" width={34} height={34} /></span>
        <span>
          <strong>PAWU</strong>
          <small>Always with us</small>
        </span>
      </Link>
      <div className="guardian-title-pill">{title}</div>
      <HomeAuthNav />
    </header>
  );
}
