"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { featureForHospitalPath, permissionForHospitalPath } from "../../lib/hospital-permissions";
import { useHospitalPermissions } from "./HospitalPermissionProvider";

export default function HospitalPermissionGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { access, loading, error, can, enabled, refresh } = useHospitalPermissions();
  const requiredPermission = permissionForHospitalPath(pathname);
  const requiredFeature = featureForHospitalPath(pathname);

  if (loading) {
    return (
      <main className="p-4 lg:p-6">
        <div className="mx-auto max-w-3xl border border-slate-300 bg-white p-8">
          <p className="text-sm font-bold text-slate-600">병원 권한을 확인하는 중입니다...</p>
        </div>
      </main>
    );
  }

  if (!access) {
    return (
      <main className="p-4 lg:p-6">
        <div className="mx-auto max-w-3xl border border-red-300 bg-white p-8">
          <p className="text-xs font-black tracking-[0.16em] text-red-600">HOSPITAL ACCESS</p>
          <h1 className="mt-2 text-2xl font-black">병원 프로그램에 접근할 수 없습니다.</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">{error || "병원 계정 또는 직원 사용 상태를 확인해 주세요."}</p>
          <div className="mt-6 flex flex-wrap gap-2">
            <button type="button" onClick={() => void refresh()} className="border border-slate-400 px-4 py-2 text-sm font-bold">다시 확인</button>
            <Link href="/login" className="bg-slate-950 px-4 py-2 text-sm font-bold text-white">로그인 화면</Link>
          </div>
        </div>
      </main>
    );
  }

  if (requiredFeature && !enabled(requiredFeature)) {
    return (
      <main className="p-4 lg:p-6">
        <div className="mx-auto max-w-3xl border border-slate-300 bg-white p-8">
          <p className="text-xs font-black tracking-[0.16em] text-slate-500">FEATURE DISABLED</p>
          <h1 className="mt-2 text-2xl font-black">병원에서 사용하지 않는 기능입니다.</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">원장이 병원 설정에서 이 기능을 다시 켜면 사용할 수 있습니다.</p>
          <Link href="/hospital-admin/dashboard" className="mt-6 inline-block bg-slate-950 px-4 py-2.5 text-sm font-black text-white">대시보드로 이동</Link>
        </div>
      </main>
    );
  }

  if (requiredPermission && !can(requiredPermission)) {
    return (
      <main className="p-4 lg:p-6">
        <div className="mx-auto max-w-3xl border border-amber-300 bg-white p-8">
          <p className="text-xs font-black tracking-[0.16em] text-amber-700">PERMISSION DENIED</p>
          <h1 className="mt-2 text-2xl font-black">접근 권한이 없습니다.</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">현재 직원 계정에는 이 메뉴를 사용할 권한이 없습니다. 원장 또는 직원 관리 담당자에게 권한 변경을 요청해 주세요.</p>
          <Link href="/hospital-admin/dashboard" className="mt-6 inline-block bg-slate-950 px-4 py-2.5 text-sm font-black text-white">대시보드로 이동</Link>
        </div>
      </main>
    );
  }

  return <>{children}</>;
}
