import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabase-admin";
import { can, getHospitalAccess, readBearer } from "../../../../lib/hospital-access";

const permissionKeys = [
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

const roleDefaults: Record<string, Record<string, boolean>> = {
  veterinarian: {
    view_dashboard: true,
    manage_reservations: true,
    view_patients: true,
    view_medical_records: true,
    write_medical_records: true,
    manage_prescriptions: true,
    manage_dispensing: false,
    manage_inventory: false,
    manage_inpatient: true,
    manage_surgery: true,
    manage_billing: false,
    manage_attachments: true,
    view_audit_logs: false,
    export_data: false,
    manage_staff: false,
    manage_security: false,
  },
  nurse: {
    view_dashboard: true,
    manage_reservations: true,
    view_patients: true,
    view_medical_records: true,
    write_medical_records: false,
    manage_prescriptions: false,
    manage_dispensing: true,
    manage_inventory: true,
    manage_inpatient: true,
    manage_surgery: false,
    manage_billing: false,
    manage_attachments: true,
    view_audit_logs: false,
    export_data: false,
    manage_staff: false,
    manage_security: false,
  },
  receptionist: {
    view_dashboard: true,
    manage_reservations: true,
    view_patients: true,
    view_medical_records: false,
    write_medical_records: false,
    manage_prescriptions: false,
    manage_dispensing: false,
    manage_inventory: false,
    manage_inpatient: false,
    manage_surgery: false,
    manage_billing: true,
    manage_attachments: false,
    view_audit_logs: false,
    export_data: false,
    manage_staff: false,
    manage_security: false,
  },
};

function normalizePermissions(value: unknown, role: string) {
  const base = roleDefaults[role];
  const source = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return Object.fromEntries(permissionKeys.map((key) => [key, source[key] === undefined ? base[key] === true : source[key] === true]));
}

async function audit(input: {
  hospitalId: number;
  userId: string;
  role: string;
  action: string;
  resourceId?: string;
  summary: string;
  metadata?: Record<string, unknown>;
  request: Request;
}) {
  await supabaseAdmin.from("hospital_audit_logs_v7").insert({
    hospital_id: input.hospitalId,
    actor_user_id: input.userId,
    actor_role: input.role,
    action: input.action,
    resource_type: "hospital_staff",
    resource_id: input.resourceId ?? null,
    severity: "info",
    summary: input.summary,
    metadata: input.metadata ?? {},
    user_agent: input.request.headers.get("user-agent"),
  });
}

export async function GET(request: Request) {
  const access = await getHospitalAccess(readBearer(request));
  if (!access || !can(access, "manage_staff")) {
    return NextResponse.json({ ok: false, message: "직원 관리 권한이 없습니다." }, { status: 403 });
  }

  const { data, error } = await supabaseAdmin
    .from("hospital_staff")
    .select("id,user_id,display_name,email,role,permissions,is_active,created_at")
    .eq("hospital_id", access.hospitalId)
    .order("is_active", { ascending: false })
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, items: data ?? [], currentUserId: access.userId, currentRole: access.role });
}

export async function POST(request: Request) {
  const access = await getHospitalAccess(readBearer(request));
  if (!access || !can(access, "manage_staff")) {
    return NextResponse.json({ ok: false, message: "직원 관리 권한이 없습니다." }, { status: 403 });
  }

  const body = await request.json() as { email?: string; name?: string; role?: string; permissions?: unknown };
  const email = String(body.email ?? "").trim().toLowerCase();
  const name = String(body.name ?? "").trim();
  const role = String(body.role ?? "");
  if (!email || !name || !roleDefaults[role]) {
    return NextResponse.json({ ok: false, message: "직원 정보를 확인해 주세요." }, { status: 400 });
  }

  const { data: users, error: listError } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
  if (listError) return NextResponse.json({ ok: false, message: listError.message }, { status: 400 });
  const target = users.users.find((user) => user.email?.toLowerCase() === email);
  if (!target) {
    return NextResponse.json({ ok: false, message: "해당 이메일로 PAWU에 가입한 사용자를 찾지 못했습니다." }, { status: 404 });
  }

  const permissions = normalizePermissions(body.permissions, role);
  const { data, error } = await supabaseAdmin.from("hospital_staff").upsert({
    hospital_id: access.hospitalId,
    user_id: target.id,
    display_name: name,
    email,
    role,
    permissions,
    is_active: true,
    invited_by: access.userId,
  }, { onConflict: "hospital_id,user_id" }).select("id").single();

  if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 400 });
  await audit({
    hospitalId: access.hospitalId,
    userId: access.userId,
    role: access.role,
    action: "staff.created",
    resourceId: String(data.id),
    summary: `${name} 직원을 등록했습니다.`,
    metadata: { email, role, permissions },
    request,
  });
  return NextResponse.json({ ok: true });
}

export async function PATCH(request: Request) {
  const access = await getHospitalAccess(readBearer(request));
  if (!access || !can(access, "manage_staff")) {
    return NextResponse.json({ ok: false, message: "직원 관리 권한이 없습니다." }, { status: 403 });
  }

  const body = await request.json() as { id?: number; role?: string; isActive?: boolean; permissions?: unknown; displayName?: string };
  const id = Number(body.id);
  const role = String(body.role ?? "");
  if (!Number.isInteger(id) || !roleDefaults[role]) {
    return NextResponse.json({ ok: false, message: "요청 값이 올바르지 않습니다." }, { status: 400 });
  }

  const { data: target } = await supabaseAdmin
    .from("hospital_staff")
    .select("id,user_id,display_name,email,role,is_active")
    .eq("id", id)
    .eq("hospital_id", access.hospitalId)
    .maybeSingle();
  if (!target) return NextResponse.json({ ok: false, message: "직원을 찾을 수 없습니다." }, { status: 404 });
  if (target.user_id === access.userId && body.isActive === false) {
    return NextResponse.json({ ok: false, message: "현재 로그인한 본인 계정은 중지할 수 없습니다." }, { status: 400 });
  }

  const permissions = normalizePermissions(body.permissions, role);
  const displayName = String(body.displayName ?? target.display_name ?? "").trim();
  const { error } = await supabaseAdmin.from("hospital_staff").update({
    display_name: displayName,
    role,
    permissions,
    is_active: body.isActive !== false,
  }).eq("id", id).eq("hospital_id", access.hospitalId);

  if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 400 });
  await audit({
    hospitalId: access.hospitalId,
    userId: access.userId,
    role: access.role,
    action: "staff.updated",
    resourceId: String(id),
    summary: `${displayName || target.email} 직원의 역할 또는 권한을 변경했습니다.`,
    metadata: { previousRole: target.role, role, isActive: body.isActive !== false, permissions },
    request,
  });
  return NextResponse.json({ ok: true });
}
