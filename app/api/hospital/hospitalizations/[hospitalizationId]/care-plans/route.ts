import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireHospitalContext } from "@/lib/hospital-api-auth";

const planTypes = new Set([
  "medication",
  "fluid",
  "feeding",
  "monitoring",
  "wound_care",
  "exercise",
  "test",
  "procedure",
  "other",
]);

const planStatuses = new Set([
  "planned",
  "active",
  "paused",
  "completed",
  "cancelled",
]);

type Body = {
  planType?: string;
  title?: string;
  instruction?: string | null;
  startAt?: string | null;
  endAt?: string | null;
  frequency?: string | null;
  scheduledTimes?: string[];
  status?: string;
};

async function verifyHospitalization(id: number, hospitalId: number) {
  return supabaseAdmin
    .from("hospitalizations")
    .select("id")
    .eq("id", id)
    .eq("hospital_id", hospitalId)
    .maybeSingle();
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ hospitalizationId: string }> },
) {
  const context = await requireHospitalContext(request);
  if ("error" in context) {
    return NextResponse.json({ message: context.error }, { status: context.status });
  }

  const { hospitalizationId: rawId } = await params;
  const hospitalizationId = Number(rawId);
  if (!Number.isInteger(hospitalizationId)) {
    return NextResponse.json({ message: "입원 기록 번호가 올바르지 않습니다." }, { status: 400 });
  }

  const { data: hospitalization, error: verifyError } =
    await verifyHospitalization(hospitalizationId, context.hospitalId);
  if (verifyError) return NextResponse.json({ message: verifyError.message }, { status: 500 });
  if (!hospitalization) return NextResponse.json({ message: "입원 기록을 찾을 수 없습니다." }, { status: 404 });

  const { data, error } = await supabaseAdmin
    .from("hospitalization_care_plans")
    .select("*")
    .eq("hospitalization_id", hospitalizationId)
    .order("status", { ascending: true })
    .order("start_at", { ascending: true })
    .order("id", { ascending: false });

  if (error) return NextResponse.json({ message: error.message }, { status: 500 });
  return NextResponse.json({ carePlans: data ?? [] });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ hospitalizationId: string }> },
) {
  const context = await requireHospitalContext(request);
  if ("error" in context) {
    return NextResponse.json({ message: context.error }, { status: context.status });
  }

  const { hospitalizationId: rawId } = await params;
  const hospitalizationId = Number(rawId);
  if (!Number.isInteger(hospitalizationId)) {
    return NextResponse.json({ message: "입원 기록 번호가 올바르지 않습니다." }, { status: 400 });
  }

  const { data: hospitalization, error: verifyError } =
    await verifyHospitalization(hospitalizationId, context.hospitalId);
  if (verifyError) return NextResponse.json({ message: verifyError.message }, { status: 500 });
  if (!hospitalization) return NextResponse.json({ message: "입원 기록을 찾을 수 없습니다." }, { status: 404 });

  const body = (await request.json()) as Body;
  const planType = String(body.planType ?? "").trim();
  const title = String(body.title ?? "").trim();
  const status = String(body.status ?? "active").trim();
  const scheduledTimes = Array.isArray(body.scheduledTimes)
    ? [...new Set(body.scheduledTimes.map((item) => String(item).trim()).filter(Boolean))]
    : [];

  if (!planTypes.has(planType)) {
    return NextResponse.json({ message: "치료 계획 종류가 올바르지 않습니다." }, { status: 400 });
  }
  if (!title) {
    return NextResponse.json({ message: "치료 계획 제목을 입력해 주세요." }, { status: 400 });
  }
  if (!planStatuses.has(status)) {
    return NextResponse.json({ message: "치료 계획 상태가 올바르지 않습니다." }, { status: 400 });
  }

  const payload = {
    hospitalization_id: hospitalizationId,
    plan_type: planType,
    title,
    instruction: String(body.instruction ?? "").trim() || null,
    start_at: body.startAt || new Date().toISOString(),
    end_at: body.endAt || null,
    frequency: String(body.frequency ?? "").trim() || null,
    scheduled_times: scheduledTimes,
    status,
    created_by: context.user.id,
  };

  const { data, error } = await supabaseAdmin
    .from("hospitalization_care_plans")
    .insert(payload)
    .select("*")
    .single();

  if (error) return NextResponse.json({ message: error.message }, { status: 500 });

  await supabaseAdmin.from("inpatient_surgery_audit_logs").insert({
    hospital_id: context.hospitalId,
    hospitalization_id: hospitalizationId,
    actor_user_id: context.user.id,
    action: "hospitalization_care_plan_created",
    after_data: data,
  });

  return NextResponse.json({ carePlan: data, message: "치료 계획이 등록되었습니다." }, { status: 201 });
}
