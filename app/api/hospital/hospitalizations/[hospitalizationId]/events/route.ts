import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireHospitalContext } from "@/lib/hospital-api-auth";

const eventTypes = new Set([
  "vital",
  "meal",
  "water",
  "medication",
  "injection",
  "iv",
  "urination",
  "defecation",
  "vomiting",
  "pain",
  "wound",
  "mobility",
  "behavior",
  "procedure",
  "round",
  "guardian_update",
  "other",
]);

type EventBody = {
  eventType?: string;
  occurredAt?: string | null;
  title?: string;
  content?: string | null;
  temperatureC?: number | string | null;
  heartRateBpm?: number | string | null;
  respiratoryRateBpm?: number | string | null;
  systolicBp?: number | string | null;
  diastolicBp?: number | string | null;
  oxygenSaturationPct?: number | string | null;
  weightKg?: number | string | null;
  painScore?: number | string | null;
  amountValue?: number | string | null;
  amountUnit?: string | null;
  statusValue?: string | null;
  abnormalFlag?: boolean;
  requiresFollowUp?: boolean;
  isGuardianVisible?: boolean;
  guardianMessage?: string | null;
};

function optionalNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

async function verifyHospitalization(
  hospitalizationId: number,
  hospitalId: number,
) {
  return supabaseAdmin
    .from("hospitalizations")
    .select("id")
    .eq("id", hospitalizationId)
    .eq("hospital_id", hospitalId)
    .maybeSingle();
}

export async function GET(
  request: NextRequest,
  {
    params,
  }: {
    params: Promise<{ hospitalizationId: string }>;
  },
) {
  const context = await requireHospitalContext(request);

  if ("error" in context) {
    return NextResponse.json(
      { message: context.error },
      { status: context.status },
    );
  }

  const { hospitalizationId: rawId } = await params;
  const hospitalizationId = Number(rawId);

  if (!Number.isInteger(hospitalizationId)) {
    return NextResponse.json(
      { message: "입원 기록 번호가 올바르지 않습니다." },
      { status: 400 },
    );
  }

  const { data: hospitalization, error: hospitalizationError } =
    await verifyHospitalization(
      hospitalizationId,
      context.hospitalId,
    );

  if (hospitalizationError) {
    return NextResponse.json(
      { message: hospitalizationError.message },
      { status: 500 },
    );
  }

  if (!hospitalization) {
    return NextResponse.json(
      { message: "입원 기록을 찾을 수 없습니다." },
      { status: 404 },
    );
  }

  const searchParams = new URL(request.url).searchParams;
  const type = searchParams.get("type")?.trim() ?? "all";

  let query = supabaseAdmin
    .from("hospitalization_events")
    .select("*")
    .eq("hospitalization_id", hospitalizationId)
    .order("occurred_at", { ascending: false })
    .order("id", { ascending: false });

  if (type !== "all") {
    query = query.eq("event_type", type);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  return NextResponse.json({ events: data ?? [] });
}

export async function POST(
  request: NextRequest,
  {
    params,
  }: {
    params: Promise<{ hospitalizationId: string }>;
  },
) {
  const context = await requireHospitalContext(request);

  if ("error" in context) {
    return NextResponse.json(
      { message: context.error },
      { status: context.status },
    );
  }

  const { hospitalizationId: rawId } = await params;
  const hospitalizationId = Number(rawId);

  if (!Number.isInteger(hospitalizationId)) {
    return NextResponse.json(
      { message: "입원 기록 번호가 올바르지 않습니다." },
      { status: 400 },
    );
  }

  const { data: hospitalization, error: hospitalizationError } =
    await verifyHospitalization(
      hospitalizationId,
      context.hospitalId,
    );

  if (hospitalizationError) {
    return NextResponse.json(
      { message: hospitalizationError.message },
      { status: 500 },
    );
  }

  if (!hospitalization) {
    return NextResponse.json(
      { message: "입원 기록을 찾을 수 없습니다." },
      { status: 404 },
    );
  }

  const body = (await request.json()) as EventBody;
  const eventType = String(body.eventType ?? "").trim();
  const title = String(body.title ?? "").trim();

  if (!eventTypes.has(eventType)) {
    return NextResponse.json(
      { message: "기록 종류가 올바르지 않습니다." },
      { status: 400 },
    );
  }

  if (!title) {
    return NextResponse.json(
      { message: "기록 제목을 입력해 주세요." },
      { status: 400 },
    );
  }

  const oxygenSaturationPct = optionalNumber(body.oxygenSaturationPct);
  if (
    oxygenSaturationPct !== null &&
    (oxygenSaturationPct < 0 || oxygenSaturationPct > 100)
  ) {
    return NextResponse.json(
      { message: "SpO₂는 0에서 100 사이여야 합니다." },
      { status: 400 },
    );
  }

  const painScore = optionalNumber(body.painScore);
  if (painScore !== null && (painScore < 0 || painScore > 10)) {
    return NextResponse.json(
      { message: "통증 점수는 0에서 10 사이여야 합니다." },
      { status: 400 },
    );
  }

  const payload = {
    hospitalization_id: hospitalizationId,
    event_type: eventType,
    occurred_at: body.occurredAt || new Date().toISOString(),
    title,
    content: String(body.content ?? "").trim() || null,
    temperature_c: optionalNumber(body.temperatureC),
    heart_rate_bpm: optionalNumber(body.heartRateBpm),
    respiratory_rate_bpm: optionalNumber(body.respiratoryRateBpm),
    systolic_bp: optionalNumber(body.systolicBp),
    diastolic_bp: optionalNumber(body.diastolicBp),
    oxygen_saturation_pct: oxygenSaturationPct,
    weight_kg: optionalNumber(body.weightKg),
    pain_score: painScore,
    amount_value: optionalNumber(body.amountValue),
    amount_unit: String(body.amountUnit ?? "").trim() || null,
    status_value: String(body.statusValue ?? "").trim() || null,
    abnormal_flag: Boolean(body.abnormalFlag),
    requires_follow_up: Boolean(body.requiresFollowUp),
    recorded_by: context.user.id,
    is_guardian_visible: Boolean(body.isGuardianVisible),
    guardian_message:
      String(body.guardianMessage ?? "").trim() || null,
  };

  const { data, error } = await supabaseAdmin
    .from("hospitalization_events")
    .insert(payload)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  await supabaseAdmin.from("inpatient_surgery_audit_logs").insert({
    hospital_id: context.hospitalId,
    hospitalization_id: hospitalizationId,
    actor_user_id: context.user.id,
    action: "hospitalization_event_created",
    after_data: data,
  });

  return NextResponse.json(
    {
      event: data,
      message: "입원 기록이 저장되었습니다.",
    },
    { status: 201 },
  );
}
