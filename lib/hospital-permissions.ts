export const hospitalPermissionKeys = [
  "view_dashboard",
  "manage_reservations",
  "view_patients",
  "view_medical_records",
  "write_medical_records",
  "manage_prescriptions",
  "manage_dispensing",
  "manage_inventory",
  "manage_inpatient",
  "manage_surgery",
  "manage_billing",
  "manage_attachments",
  "view_audit_logs",
  "export_data",
  "manage_staff",
  "manage_security",
] as const;

export type HospitalPermission = (typeof hospitalPermissionKeys)[number];
export type HospitalRole =
  | "owner"
  | "veterinarian"
  | "nurse"
  | "receptionist"
  | "inventory_manager"
  | "viewer";

export const hospitalFeatureKeys = [
  "inpatient_enabled",
  "surgery_enabled",
  "inventory_enabled",
  "dispensing_enabled",
  "billing_enabled",
  "lab_enabled",
  "guardian_chat_enabled",
] as const;
export type HospitalFeature = (typeof hospitalFeatureKeys)[number];

export type HospitalAccessSnapshot = {
  userId: string;
  hospitalId: number;
  role: HospitalRole;
  permissions: Record<string, boolean>;
  features: Record<string, boolean>;
};

export const hospitalRoleLabels: Record<HospitalRole, string> = {
  owner: "원장",
  veterinarian: "수의사",
  nurse: "간호·테크니션",
  receptionist: "접수 직원",
  inventory_manager: "재고 담당",
  viewer: "조회 전용",
};

export function hasHospitalPermission(
  access: HospitalAccessSnapshot | null,
  permission: HospitalPermission,
) {
  return access?.role === "owner" || access?.permissions?.[permission] === true;
}

export type HospitalRouteRule = {
  prefix: string;
  permission: HospitalPermission;
};

// 긴 경로부터 검사하여 세부 경로의 규칙이 우선 적용됩니다.
export const hospitalRouteRules: HospitalRouteRule[] = [
  { prefix: "/hospital-admin/inpatient-surgery", permission: "manage_surgery" },
  { prefix: "/hospital-admin/medical-records", permission: "view_medical_records" },
  { prefix: "/hospital-admin/prescriptions", permission: "manage_prescriptions" },
  { prefix: "/hospital-admin/reservations", permission: "manage_reservations" },
  { prefix: "/hospital-admin/workflow-v6-2", permission: "view_dashboard" },
  { prefix: "/hospital-admin/audit-logs", permission: "view_audit_logs" },
  { prefix: "/hospital-admin/dispensing", permission: "manage_dispensing" },
  { prefix: "/hospital-admin/inpatients", permission: "manage_inpatient" },
  { prefix: "/hospital-admin/inventory", permission: "manage_inventory" },
  { prefix: "/hospital-admin/medications", permission: "manage_inventory" },
  { prefix: "/hospital-admin/reception", permission: "manage_reservations" },
  { prefix: "/hospital-admin/calendar", permission: "manage_reservations" },
  { prefix: "/hospital-admin/patients", permission: "view_patients" },
  { prefix: "/hospital-admin/billing", permission: "manage_billing" },
  { prefix: "/hospital-admin/staff", permission: "manage_staff" },
  { prefix: "/hospital-admin/settings", permission: "manage_security" },
  { prefix: "/hospital-admin/analytics", permission: "view_dashboard" },
  { prefix: "/hospital-admin/dashboard", permission: "view_dashboard" },
  { prefix: "/hospital-admin/emr", permission: "view_medical_records" },
  { prefix: "/hospital-admin/lab", permission: "manage_attachments" },
  { prefix: "/hospital-admin/chat", permission: "view_patients" },
];

export function permissionForHospitalPath(pathname: string) {
  if (pathname === "/hospital-admin") return "view_dashboard" as const;
  const rule = hospitalRouteRules.find(
    (item) => pathname === item.prefix || pathname.startsWith(`${item.prefix}/`),
  );
  return rule?.permission ?? null;
}


export function hasHospitalFeature(access: HospitalAccessSnapshot | null, feature: HospitalFeature) {
  return access?.features?.[feature] !== false;
}

export const hospitalFeatureRouteRules: { prefix: string; feature: HospitalFeature }[] = [
  { prefix: "/hospital-admin/inpatient-surgery", feature: "surgery_enabled" },
  { prefix: "/hospital-admin/inpatients", feature: "inpatient_enabled" },
  { prefix: "/hospital-admin/inventory", feature: "inventory_enabled" },
  { prefix: "/hospital-admin/medications", feature: "inventory_enabled" },
  { prefix: "/hospital-admin/dispensing", feature: "dispensing_enabled" },
  { prefix: "/hospital-admin/billing", feature: "billing_enabled" },
  { prefix: "/hospital-admin/lab", feature: "lab_enabled" },
  { prefix: "/hospital-admin/chat", feature: "guardian_chat_enabled" },
];

export function featureForHospitalPath(pathname: string) {
  return hospitalFeatureRouteRules.find((item) => pathname === item.prefix || pathname.startsWith(`${item.prefix}/`))?.feature ?? null;
}
