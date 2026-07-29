import { NextResponse } from "next/server";
import { requirePlatformAccess, writeAudit } from "../../../../../lib/v7-platform-access";

const rolePermissions: Record<string, string[]> = {
  owner: ["view_dashboard","view_patients","write_medical_records","manage_prescriptions","manage_dispensing","manage_billing","manage_inventory","manage_inpatient","manage_surgery","manage_staff","view_audit_logs","export_data","manage_security"],
  veterinarian: ["view_dashboard","view_patients","write_medical_records","manage_prescriptions","manage_inpatient","manage_surgery"],
  nurse: ["view_dashboard","view_patients","manage_dispensing","manage_inventory","manage_inpatient"],
  receptionist: ["view_dashboard","view_patients","manage_billing"],
  inventory_manager: ["view_dashboard","manage_inventory"],
  viewer: ["view_dashboard","view_patients"],
};

export async function GET(request: Request) {
  const auth = await requirePlatformAccess(request, "manage_security");
  if (!auth.ok) return NextResponse.json({ ok:false, message:auth.message }, { status:auth.status });
  const { data, error } = await auth.supabaseAdmin.from("hospital_staff")
    .select("user_id,hospital_id,role,permissions,is_active,created_at")
    .eq("hospital_id", auth.access.hospitalId).order("created_at");
  if (error) return NextResponse.json({ ok:false, message:error.message }, { status:400 });
  return NextResponse.json({ ok:true, staff:data ?? [], rolePermissions });
}

export async function PATCH(request: Request) {
  const auth = await requirePlatformAccess(request, "manage_security");
  if (!auth.ok) return NextResponse.json({ ok:false, message:auth.message }, { status:auth.status });
  const body = await request.json().catch(()=>({}));
  const userId = String(body.userId ?? "");
  const role = String(body.role ?? "viewer");
  if (!userId || !rolePermissions[role]) return NextResponse.json({ ok:false, message:"직원과 역할을 확인하세요." }, { status:400 });
  const permissions = Object.fromEntries(rolePermissions[role].map((key)=>[key,true]));
  const { error } = await auth.supabaseAdmin.from("hospital_staff").update({ role, permissions })
    .eq("hospital_id", auth.access.hospitalId).eq("user_id", userId);
  if (error) return NextResponse.json({ ok:false, message:error.message }, { status:400 });
  await writeAudit(auth.access, { action:"security.role_changed", resourceType:"hospital_staff", resourceId:userId, summary:`직원 역할을 ${role}(으)로 변경`, severity:"warning", metadata:{ role } });
  return NextResponse.json({ ok:true });
}
