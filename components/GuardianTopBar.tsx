"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import HomeAuthNav from "./HomeAuthNav";

const labels: Record<string, string> = {
  "/pets": "우리 아이",
  "/my-reservations": "예약",
  "/health-notebook": "건강기록",
  "/account": "내 정보",
};

export default function GuardianTopBar() {
  const pathname = usePathname();
  if (pathname.startsWith("/map")) return null;
  const title = Object.entries(labels).find(([path]) => pathname.startsWith(path))?.[1];

  return (
    <header className="guardian-topbar v9-topbar">
      <Link href="/" className="guardian-brand v9-brand" aria-label="PAWU 홈">
        <span className="guardian-brand-mark"><Image src="/pawu-v9-03-symbol.svg" alt="" width={36} height={36} priority /></span>
        <span><strong>PAWU</strong><small>Always with us</small></span>
      </Link>
      {title ? <div className="v9-page-title">{title}</div> : <div />}
      <HomeAuthNav />
    </header>
  );
}
