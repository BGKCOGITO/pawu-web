import type { ReactNode } from "react";
import HospitalAdminShell from "../../components/hospital/HospitalAdminShell";

export default function HospitalAdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <HospitalAdminShell>{children}</HospitalAdminShell>;
}
