"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/", label: "홈", icon: "⌂" },
  { href: "/map", label: "병원", icon: "⌖" },
  { href: "/pets", label: "아이들", icon: "✦" },
  { href: "/my-reservations", label: "예약", icon: "▦" },
  { href: "/account", label: "내 정보", icon: "◉" },
];

export default function GuardianBottomNav() {
  const pathname = usePathname();
  return (
    <nav className="guardian-bottom-nav">
      <div className="guardian-bottom-nav-inner">
        {items.map((item) => {
          const active = item.href === "/" ? pathname === "/" || pathname === "/dashboard" : pathname.startsWith(item.href);
          return <Link key={item.href} href={item.href} className={active ? "active" : ""}><span className="nav-icon">{item.icon}</span><span>{item.label}</span></Link>;
        })}
      </div>
    </nav>
  );
}
