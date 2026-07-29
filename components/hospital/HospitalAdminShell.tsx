"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import HospitalSidebar from "./HospitalSidebar";
import HospitalTopbar from "./HospitalTopbar";
import HospitalPermissionGate from "./HospitalPermissionGate";
import HospitalPermissionProvider from "./HospitalPermissionProvider";

export default function HospitalAdminShell({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <HospitalPermissionProvider>
      <div className="min-h-screen bg-slate-100 text-slate-950" data-pawu-hospital-shell="true">
        <HospitalSidebar
          mobileOpen={mobileOpen}
          collapsed={sidebarCollapsed}
          onCloseMobile={() => setMobileOpen(false)}
        />

        <div className={`min-h-screen transition-[padding] duration-200 ${sidebarCollapsed ? "lg:pl-[76px]" : "lg:pl-64"}`}>
          <HospitalTopbar
            sidebarCollapsed={sidebarCollapsed}
            onOpenMobile={() => setMobileOpen(true)}
            onToggleSidebar={() => setSidebarCollapsed((value) => !value)}
          />

          <div className="min-w-0">
            <HospitalPermissionGate>{children}</HospitalPermissionGate>
          </div>
        </div>
      </div>
    </HospitalPermissionProvider>
  );
}
