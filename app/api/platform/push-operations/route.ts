import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabase-admin";
import { getUserFromRequest, isMasterAdmin } from "../../../../lib/platform-access";

async function authorize(request: Request) {
  const user = await getUserFromRequest(request);
  return Boolean(user && (await isMasterAdmin(user.id)));
}

export async function GET(request: Request) {
  if (!(await authorize(request))) {
    return NextResponse.json({ ok: false, message: "관리자 권한이 없습니다." }, { status: 403 });
  }

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const [jobsResult, tokensResult] = await Promise.all([
    supabaseAdmin
      .from("push_jobs")
      .select("id,status,attempts,max_attempts,last_error,created_at,updated_at,sent_at,payload")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(100),
    supabaseAdmin.from("fcm_tokens").select("id", { count: "exact", head: true }).eq("is_active", true),
  ]);

  if (jobsResult.error) {
    return NextResponse.json({ ok: false, message: jobsResult.error.message }, { status: 500 });
  }

  const jobs = jobsResult.data ?? [];
  const counts = jobs.reduce<Record<string, number>>((acc, job) => {
    acc[job.status] = (acc[job.status] ?? 0) + 1;
    return acc;
  }, {});

  return NextResponse.json({
    ok: true,
    data: {
      activeTokens: tokensResult.count ?? 0,
      total24h: jobs.length,
      counts,
      jobs: jobs.slice(0, 30),
    },
  });
}

export async function POST(request: Request) {
  if (!(await authorize(request))) {
    return NextResponse.json({ ok: false, message: "관리자 권한이 없습니다." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  if (body.action === "retry" && typeof body.jobId === "string") {
    const { error } = await supabaseAdmin.rpc("retry_push_job", { p_job_id: body.jobId });
    if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "recover") {
    const { data, error } = await supabaseAdmin.rpc("recover_stale_push_jobs", { p_stale_after: "00:05:00" });
    if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, recovered: data ?? 0 });
  }

  return NextResponse.json({ ok: false, message: "지원하지 않는 작업입니다." }, { status: 400 });
}
