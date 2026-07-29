import type { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/server/api-response";
import { requireHospitalContext } from "@/lib/hospital-api-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

const CATEGORIES = new Set(["bug", "improvement", "question", "data", "other"]);
const SEVERITIES = new Set(["low", "normal", "high", "critical"]);

export async function GET(request: NextRequest) {
  const context = await requireHospitalContext(request, "view_dashboard");
  if (context.error) return apiError(context.code, context.error, context.status);

  const [announcements, feedback] = await Promise.all([
    supabaseAdmin
      .from("beta_announcements")
      .select("id,title,content,level,published_at,expires_at")
      .eq("is_published", true)
      .or(`hospital_id.is.null,hospital_id.eq.${context.hospitalId}`)
      .or(`expires_at.is.null,expires_at.gte.${new Date().toISOString()}`)
      .order("published_at", { ascending: false })
      .limit(10),
    supabaseAdmin
      .from("beta_feedback")
      .select("id,category,severity,title,status,created_at,updated_at,operator_note")
      .eq("hospital_id", context.hospitalId)
      .order("created_at", { ascending: false })
      .limit(30),
  ]);

  if (announcements.error || feedback.error) {
    return apiError(
      "INTERNAL_ERROR",
      announcements.error?.message ?? feedback.error?.message ?? "베타 운영 정보를 불러오지 못했습니다.",
      500,
    );
  }

  return apiSuccess({
    announcements: announcements.data ?? [],
    feedback: feedback.data ?? [],
  });
}

export async function POST(request: NextRequest) {
  const context = await requireHospitalContext(request, "view_dashboard");
  if (context.error) return apiError(context.code, context.error, context.status);
  if (!context.user) return apiError("UNAUTHORIZED", "로그인이 필요합니다.", 401);

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const category = String(body?.category ?? "");
  const severity = String(body?.severity ?? "normal");
  const title = String(body?.title ?? "").trim();
  const description = String(body?.description ?? "").trim();
  const pageUrl = String(body?.pageUrl ?? "").slice(0, 1000);
  const browserInfo = String(body?.browserInfo ?? "").slice(0, 2000);

  if (!CATEGORIES.has(category) || !SEVERITIES.has(severity)) {
    return apiError("BAD_REQUEST", "분류 또는 중요도 값이 올바르지 않습니다.", 400);
  }
  if (title.length < 2 || title.length > 120) {
    return apiError("BAD_REQUEST", "제목은 2~120자로 입력해 주세요.", 400);
  }
  if (description.length < 5 || description.length > 5000) {
    return apiError("BAD_REQUEST", "상세 내용은 5~5000자로 입력해 주세요.", 400);
  }

  const { data, error } = await supabaseAdmin
    .from("beta_feedback")
    .insert({
      hospital_id: context.hospitalId,
      reporter_user_id: context.user.id,
      reporter_email: context.user.email ?? null,
      category,
      severity,
      title,
      description,
      page_url: pageUrl || null,
      browser_info: browserInfo || null,
      status: "received",
    })
    .select("id,status,created_at")
    .single();

  if (error) return apiError("INTERNAL_ERROR", error.message, 500);
  return apiSuccess(data, { status: 201 });
}
