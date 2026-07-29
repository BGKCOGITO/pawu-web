"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const menuItems = [
  {
    href: "/admin",
    label: "대시보드",
    icon: "⌂",
    exact: true,
  },
  {
    href: "/admin/hospitals",
    label: "병원관리",
    icon: "✚",
  },
  {
    href: "/admin/reservations",
    label: "예약관리",
    icon: "▣",
  },
  {
    href: "/admin/users",
    label: "회원관리",
    icon: "♙",
  },
  {
    href: "/admin/reviews",
    label: "리뷰관리",
    icon: "★",
  },
  {
    href: "/admin/settings",
    label: "설정",
    icon: "⚙",
  },
];

function isActivePath(
  pathname: string,
  href: string,
  exact?: boolean
) {
  if (exact) {
    return pathname === href;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function AdminSidebar() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <div className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 lg:hidden">
        <Link href="/admin" className="font-black tracking-tight">
          PAWU ADMIN
        </Link>

        <button
          type="button"
          onClick={() => setIsOpen((current) => !current)}
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold"
          aria-label="관리자 메뉴 열기"
        >
          {isOpen ? "닫기" : "메뉴"}
        </button>
      </div>

      {isOpen && (
        <button
          type="button"
          aria-label="메뉴 닫기"
          className="fixed inset-0 z-40 bg-black/30 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      <aside
        className={[
          "fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-slate-200 bg-white transition-transform lg:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full",
        ].join(" ")}
      >
        <div className="flex h-20 items-center border-b border-slate-100 px-6">
          <Link
            href="/admin"
            className="flex items-center gap-3"
            onClick={() => setIsOpen(false)}
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-lg text-white">
              P
            </span>

            <span>
              <strong className="block text-lg font-black tracking-tight">
                PAWU ADMIN
              </strong>
              <span className="text-xs text-slate-500">
                서비스 운영센터
              </span>
            </span>
          </Link>
        </div>

        <nav className="flex-1 space-y-2 overflow-y-auto px-4 py-6">
          {menuItems.map((item) => {
            const active = isActivePath(
              pathname,
              item.href,
              item.exact
            );

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setIsOpen(false)}
                className={[
                  "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition",
                  active
                    ? "bg-slate-950 text-white shadow-sm"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-950",
                ].join(" ")}
              >
                <span
                  className={[
                    "flex h-8 w-8 items-center justify-center rounded-xl text-base",
                    active ? "bg-white/15" : "bg-slate-100",
                  ].join(" ")}
                >
                  {item.icon}
                </span>

                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-slate-100 p-4">
          <Link
            href="/"
            className="block rounded-2xl border border-slate-200 px-4 py-3 text-center text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            PAWU 사용자 화면
          </Link>
        </div>
      </aside>
    </>
  );
}
