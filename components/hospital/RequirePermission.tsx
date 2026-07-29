"use client";

import type { ReactNode } from "react";
import type { HospitalPermission } from "../../lib/hospital-permissions";
import { useHospitalPermissions } from "./HospitalPermissionProvider";

export default function RequirePermission({
  permission,
  children,
  fallback = null,
}: {
  permission: HospitalPermission;
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const { loading, can } = useHospitalPermissions();
  if (loading || !can(permission)) return <>{fallback}</>;
  return <>{children}</>;
}
