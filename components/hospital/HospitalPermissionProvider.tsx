"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { supabase } from "../../lib/supabase";
import type {
  HospitalAccessSnapshot,
  HospitalPermission,
  HospitalFeature,
  HospitalRole,
} from "../../lib/hospital-permissions";
import { hasHospitalFeature, hasHospitalPermission } from "../../lib/hospital-permissions";

type PermissionContextValue = {
  access: HospitalAccessSnapshot | null;
  loading: boolean;
  error: string;
  refresh: () => Promise<void>;
  can: (permission: HospitalPermission) => boolean;
  enabled: (feature: HospitalFeature) => boolean;
};

const HospitalPermissionContext = createContext<PermissionContextValue | null>(null);

const DEFAULT_FEATURES: Record<string, boolean> = {
  inpatient_enabled: true,
  surgery_enabled: true,
  inventory_enabled: true,
  dispensing_enabled: true,
  billing_enabled: true,
  lab_enabled: true,
  guardian_chat_enabled: true,
};

const OWNER_PERMISSIONS: Record<string, boolean> = {
  view_dashboard: true,
  manage_reservations: true,
  view_patients: true,
  view_medical_records: true,
  write_medical_records: true,
  manage_prescriptions: true,
  manage_dispensing: true,
  manage_inventory: true,
  manage_inpatient: true,
  manage_surgery: true,
  manage_billing: true,
  manage_attachments: true,
  view_audit_logs: true,
  export_data: true,
  manage_staff: true,
  manage_security: true,
};

/**
 * 기존 병원 화면에서 오랫동안 사용해 온 클라이언트 직접 조회 방식입니다.
 * /api/hospital/access가 일시적으로 실패하더라도 로그인된 병원 계정이
 * 전체 병원 프로그램에서 차단되지 않도록 안전한 대체 경로로 사용합니다.
 */
async function loadDirectHospitalAccess(): Promise<HospitalAccessSnapshot | null> {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  const user = authData.user;
  if (authError || !user) return null;

  const { data: staff } = await supabase
    .from("hospital_staff")
    .select("hospital_id,role,permissions,is_active")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  let hospitalId = staff?.hospital_id ? Number(staff.hospital_id) : null;
  let role: HospitalRole = (staff?.role as HospitalRole | undefined) ?? "viewer";
  let permissions =
    staff?.permissions && typeof staff.permissions === "object"
      ? (staff.permissions as Record<string, boolean>)
      : {};

  if (!hospitalId) {
    const { data: admin } = await supabase
      .from("hospital_admins")
      .select("hospital_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (admin?.hospital_id) {
      hospitalId = Number(admin.hospital_id);
      role = "owner";
      permissions = OWNER_PERMISSIONS;
    }
  }

  if (!hospitalId || !Number.isFinite(hospitalId)) return null;

  let features = { ...DEFAULT_FEATURES };
  const { data: featureRow } = await supabase
    .from("hospital_module_settings")
    .select(
      "inpatient_enabled,surgery_enabled,inventory_enabled,dispensing_enabled,billing_enabled,lab_enabled,guardian_chat_enabled",
    )
    .eq("hospital_id", hospitalId)
    .maybeSingle();

  if (featureRow) features = { ...features, ...featureRow };

  return {
    userId: user.id,
    hospitalId,
    role,
    permissions,
    features,
  };
}

export default function HospitalPermissionProvider({ children }: { children: ReactNode }) {
  const [access, setAccess] = useState<HospitalAccessSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function refresh() {
    setLoading(true);
    setError("");

    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) {
      setAccess(null);
      setError("병원 계정으로 다시 로그인해 주세요.");
      setLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/hospital/access", {
        headers: { authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const json = (await response.json().catch(() => null)) as {
        message?: string;
        access?: HospitalAccessSnapshot;
      } | null;

      if (response.ok && json?.access) {
        setAccess(json.access);
        return;
      }

      // 서버 권한 API가 실패해도 기존 병원 계정 조회 방식으로 한 번 더 확인합니다.
      const fallbackAccess = await loadDirectHospitalAccess();
      if (fallbackAccess) {
        setAccess(fallbackAccess);
        return;
      }

      setAccess(null);
      setError(json?.message ?? "사용 가능한 병원 계정이 없습니다.");
    } catch {
      // 네트워크·API 런타임 오류가 전체 병원 프로그램 접근 차단으로 이어지지 않도록 합니다.
      const fallbackAccess = await loadDirectHospitalAccess().catch(() => null);
      if (fallbackAccess) {
        setAccess(fallbackAccess);
      } else {
        setAccess(null);
        setError("병원 계정 정보를 확인하지 못했습니다. 잠시 후 다시 확인해 주세요.");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  const value = useMemo<PermissionContextValue>(
    () => ({
      access,
      loading,
      error,
      refresh,
      can: (permission) => hasHospitalPermission(access, permission),
      enabled: (feature) => hasHospitalFeature(access, feature),
    }),
    [access, loading, error],
  );

  return (
    <HospitalPermissionContext.Provider value={value}>
      {children}
    </HospitalPermissionContext.Provider>
  );
}

export function useHospitalPermissions() {
  const context = useContext(HospitalPermissionContext);
  if (!context) {
    throw new Error("useHospitalPermissions must be used inside HospitalPermissionProvider");
  }
  return context;
}
