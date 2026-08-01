"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { HospitalFeature, HospitalPermission } from "../../lib/hospital-permissions";
import { useHospitalPermissions } from "./HospitalPermissionProvider";

type MenuItem = {
  href: string;
  label: string;
  shortLabel: string;
  icon: string;
  exact?: boolean;
  permission: HospitalPermission;
  feature?: HospitalFeature;
};

type MenuGroup = {
  title: string;
  items: MenuItem[];
};

const menuGroups: MenuGroup[] = [
  {
    title: "업무",
    items: [
      {
        href: "/hospital-admin/dashboard",
        label: "대시보드",
        shortLabel: "홈",
        icon: "▦",
        permission: "view_dashboard",
        exact: true,
      },
      {
        href: "/hospital-admin/workflow-v6-2",
        label: "오늘의 업무",
        shortLabel: "업무",
        icon: "✓",
        permission: "view_dashboard",
      },
      {
        href: "/hospital-admin/reservations",
        label: "예약 관리",
        shortLabel: "예약",
        icon: "▤",
        permission: "manage_reservations",
      },
      {
        href: "/hospital-admin/calendar",
        label: "예약·캘린더",
        shortLabel: "달력",
        icon: "□",
        permission: "manage_reservations",
      },
      {
        href: "/hospital-admin/reception",
        label: "접수·대기",
        shortLabel: "접수",
        icon: "W",
        permission: "manage_reservations",
      },
      {
        href: "/hospital-admin/patients",
        label: "환자 관리",
        shortLabel: "환자",
        icon: "●",
        permission: "view_patients",
      },
    ],
  },
  {
    title: "진료",
    items: [
      {
        href: "/hospital-admin/emr",
        label: "전자차트",
        shortLabel: "EMR",
        icon: "＋",
        permission: "view_medical_records",
      },
      {
        href: "/hospital-admin/medical-records",
        label: "진료 기록",
        shortLabel: "기록",
        icon: "≡",
        permission: "view_medical_records",
      },
      {
        href: "/hospital-admin/prescriptions",
        label: "처방 관리",
        shortLabel: "처방",
        icon: "Rx",
        permission: "manage_prescriptions",
      },      {
        href: "/hospital-admin/dispensing",
        label: "조제 관리",
        shortLabel: "조제",
        icon: "D",
        permission: "manage_dispensing",
        feature: "dispensing_enabled",
      },
      {
        href: "/hospital-admin/lab",
        label: "검사·영상",
        shortLabel: "검사",
        icon: "◇",
        permission: "manage_attachments",
        feature: "lab_enabled",
      },
    ],
  },
  {
    title: "병원 운영",
    items: [
      {
        href: "/hospital-admin/inpatients",
        label: "입원 차트",
        shortLabel: "입원",
        icon: "H",
        permission: "manage_inpatient",
        feature: "inpatient_enabled",
      },
      {
        href: "/hospital-admin/inpatient-surgery",
        label: "병상·수술",
        shortLabel: "수술",
        icon: "S",
        permission: "manage_surgery",
        feature: "surgery_enabled",
      },
      {
        href: "/hospital-admin/inventory",
        label: "재고 관리",
        shortLabel: "재고",
        icon: "▣",
        permission: "manage_inventory",
        feature: "inventory_enabled",
      },
      {
        href: "/hospital-admin/medications",
        label: "약품 관리",
        shortLabel: "약품",
        icon: "M",
        permission: "manage_inventory",
        feature: "inventory_enabled",
      },
      {
        href: "/hospital-admin/billing",
        label: "수납 관리",
        shortLabel: "수납",
        icon: "₩",
        permission: "manage_billing",
        feature: "billing_enabled",
      },
      {
        href: "/hospital-admin/staff",
        label: "직원 관리",
        shortLabel: "직원",
        icon: "◎",
        permission: "manage_staff",
      },
      {
        href: "/hospital-admin/business-hours",
        label: "운영시간 관리",
        shortLabel: "시간",
        icon: "◷",
        permission: "manage_reservations",
      },
      {
        href: "/hospital-admin/time-blocks",
        label: "예약시간 열기·닫기",
        shortLabel: "마감",
        icon: "⊘",
        permission: "manage_reservations",
      },
      {
        href: "/hospital-admin/analytics",
        label: "운영 분석",
        shortLabel: "분석",
        icon: "↗",
        permission: "view_dashboard",
      },
    ],
  },
  {
    title: "관리",
    items: [
      {
        href: "/hospital-admin/chat",
        label: "보호자 채팅",
        shortLabel: "채팅",
        icon: "…",
        permission: "view_patients",
        feature: "guardian_chat_enabled",
      },
      {
        href: "/hospital-admin/audit-logs",
        label: "감사 로그",
        shortLabel: "로그",
        icon: "!",
        permission: "view_audit_logs",
      },
      {
        href: "/hospital-admin/beta-center",
        label: "베타 운영센터",
        shortLabel: "베타",
        icon: "B",
        permission: "view_dashboard",
      },
      {
        href: "/hospital-admin/settings",
        label: "병원 설정",
        shortLabel: "설정",
        icon: "⚙",
        permission: "manage_security",
      },
    ],
  },
];

function activePath(pathname: string, item: MenuItem) {
  if (
    item.href === "/hospital-admin/dashboard" &&
    pathname === "/hospital-admin"
  ) {
    return true;
  }

  if (item.exact) {
    return pathname === item.href;
  }

  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export default function HospitalSidebar({
  mobileOpen,
  collapsed,
  onCloseMobile,
}: {
  mobileOpen: boolean;
  collapsed: boolean;
  onCloseMobile: () => void;
}) {
  const pathname = usePathname();
  const { loading, can, enabled } = useHospitalPermissions();

  return (
    <>
      {mobileOpen && (
        <button
          type="button"
          aria-label="메뉴 닫기"
          onClick={onCloseMobile}
          className="fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-[1px] lg:hidden"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex flex-col border-r border-slate-800 bg-slate-950 text-white shadow-2xl transition-[width,transform] duration-200 lg:translate-x-0 ${
          collapsed ? "w-[76px]" : "w-64"
        } ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div
          className={`flex h-16 items-center border-b border-slate-800 ${
            collapsed ? "justify-center px-2" : "px-5"
          }`}
        >
          <Link
            href="/hospital-admin/dashboard"
            onClick={onCloseMobile}
            className="min-w-0"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-600 bg-white text-sm font-black text-slate-950">
                P
              </span>
              {!collapsed && (
                <div className="min-w-0">
                  <p className="truncate text-sm font-black tracking-[0.18em]">
                    PAWU
                  </p>
                  <p className="truncate text-[10px] font-semibold text-slate-400">
                    HOSPITAL DESKTOP
                  </p>
                </div>
              )}
            </div>
          </Link>
        </div>

        <nav className="flex-1 overflow-y-auto overflow-x-hidden px-2 py-4">
          {menuGroups.map((group) => {
            const visibleItems = loading ? [] : group.items.filter((item) => can(item.permission) && (!item.feature || enabled(item.feature)));
            if (visibleItems.length === 0) return null;
            return (
            <section key={group.title} className="mb-5">
              {!collapsed && (
                <p className="px-3 pb-2 text-[10px] font-bold tracking-[0.16em] text-slate-500">
                  {group.title}
                </p>
              )}

              <div className="space-y-1">
                {visibleItems.map((item) => {
                  const active = activePath(pathname, item);

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      title={collapsed ? item.label : undefined}
                      onClick={onCloseMobile}
                      className={`group flex h-10 items-center rounded-md border text-sm transition ${
                        collapsed
                          ? "justify-center px-1"
                          : "gap-3 px-3"
                      } ${
                        active
                          ? "border-slate-600 bg-white font-bold text-slate-950"
                          : "border-transparent text-slate-300 hover:border-slate-700 hover:bg-slate-900 hover:text-white"
                      }`}
                    >
                      <span
                        className={`flex h-6 w-6 shrink-0 items-center justify-center text-xs font-black ${
                          active ? "text-slate-950" : "text-slate-400"
                        }`}
                      >
                        {item.icon}
                      </span>

                      {!collapsed && (
                        <span className="truncate">{item.label}</span>
                      )}

                      {collapsed && (
                        <span className="pointer-events-none fixed left-[82px] z-[70] hidden whitespace-nowrap rounded border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-semibold text-white shadow-xl group-hover:block">
                          {item.label}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </section>
          );
          })}
        </nav>

        <div
          className={`border-t border-slate-800 py-3 text-[10px] text-slate-500 ${
            collapsed ? "px-2 text-center" : "px-5"
          }`}
        >
          {collapsed ? "V8.5.0" : "PAWU Hospital Desktop · V8.5.0"}
        </div>
      </aside>
    </>
  );
}

