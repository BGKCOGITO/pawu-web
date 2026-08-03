import { redirect } from "next/navigation";

export default function HospitalAdminRootPage() {
  redirect("/auth/hospital-login");
}
