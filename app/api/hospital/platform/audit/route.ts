import { NextResponse } from "next/server";
import { requirePlatformAccess, writeAudit } from "../../../../../lib/v7-platform-access";

export async function GET(request: Request) {
  const auth = await requirePlatformAccess(request, "view_audit_logs");
  if (!auth.ok) return NextResponse.json({ ok:false, message:auth.message }, { status:auth.status });
  const url = new URL(request.url);
  const severity = url.searchParams.get("severity");
  const search = url.searchParams.get("search")?.trim();
  let query = auth.supabaseAdmin.from("hospital_audit_logs_v7")
    .select("id,action,resource_type,resource_id,actor_user_id,actor_role,severity,summary,metadata,created_at")
    .eq("hospital_id", auth.access.hospitalId).order("created_at", { ascending:false }).limit(200);
  if (severity && severity !== "all") query = query.eq("severity", severity);
  if (search) query = query.or(`summary.ilike.%${search}%,action.ilike.%${search}%,resource_type.ilike.%${search}%`);
  const { data, error } = await query;
  if (error) return NextResponse.json({ ok:false, message:error.message }, { status:400 });
  return NextResponse.json({ ok:true, logs:data ?? [] });
}

export async function POST(request: Request) {
  const auth = await requirePlatformAccess(request, "view_dashboard");
  if (!auth.ok) return NextResponse.json({ ok:false, message:auth.message }, { status:auth.status });
  const body = await request.json().catch(()=>({}));
  await writeAudit(auth.access, {
    action: String(body.action ?? "platform.event"), resourceType: String(body.resourceType ?? "platform"),
    resourceId: body.resourceId ?? null, summary: String(body.summary ?? "플랫폼 이벤트"),
    severity: ["info","warning","critical"].includes(body.severity) ? body.severity : "info",
    metadata: typeof body.metadata === "object" && body.metadata ? body.metadata : {},
  });
  return NextResponse.json({ ok:true });
}
