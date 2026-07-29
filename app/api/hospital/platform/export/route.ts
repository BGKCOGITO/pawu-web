import { NextResponse } from "next/server";
import { requirePlatformAccess, writeAudit } from "../../../../../lib/v7-platform-access";

export async function GET(request: Request) {
  const auth = await requirePlatformAccess(request, "export_data");
  if (!auth.ok) return NextResponse.json({ ok:false, message:auth.message }, { status:auth.status });
  const h = auth.access.hospitalId;
  const db = auth.supabaseAdmin;
  const [reservations,audit] = await Promise.all([
    db.from("reservations").select("id,pet_id,reservation_date,reservation_time,status,visit_reason,created_at").eq("hospital_id",h).limit(5000),
    db.from("hospital_audit_logs_v7").select("action,resource_type,resource_id,actor_role,severity,summary,created_at").eq("hospital_id",h).limit(5000),
  ]);
  const error = reservations.error || audit.error;
  if (error) return NextResponse.json({ ok:false, message:error.message }, { status:400 });
  const payload = { exportedAt:new Date().toISOString(), hospitalId:h, version:"7.0.0", reservations:reservations.data ?? [], auditLogs:audit.data ?? [] };
  await writeAudit(auth.access, { action:"data.export", resourceType:"hospital", resourceId:h, summary:"병원 데이터 내보내기 실행", severity:"warning" });
  return new NextResponse(JSON.stringify(payload, null, 2), { headers:{ "content-type":"application/json; charset=utf-8", "content-disposition":`attachment; filename="pawu-hospital-${h}-${new Date().toISOString().slice(0,10)}.json"` } });
}
