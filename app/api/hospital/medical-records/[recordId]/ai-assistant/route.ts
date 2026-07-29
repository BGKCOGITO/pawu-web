import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireHospitalContext } from "@/lib/hospital-api-auth";
import { generateMedicalDraft } from "@/lib/ai/medical-assistant";
import { writeAuditLogV2 } from "@/lib/server/audit-v2";
import { enforceRateLimit } from "@/lib/server/security-policy";


async function readRecord(recordId: number, hospitalId: number) {
  return supabaseAdmin
    .from("medical_records")
    .select(`
      id,hospital_id,pet_id,chief_complaint,subjective,objective,assessment,plan,
      diagnosis,treatment,follow_up,guardian_summary,care_instructions,
      medication_instructions,next_visit_date,
      pets(name,species),
      medical_prescriptions(medication_name,dosage,frequency,duration,route,instructions)
    `)
    .eq("id", recordId)
    .eq("hospital_id", hospitalId)
    .maybeSingle();
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ recordId: string }> },
) {
  const context = await requireHospitalContext(request, "view_medical_records");
  if ("error" in context) return NextResponse.json({ message: context.error }, { status: context.status });
  const recordId = Number((await params).recordId);
  if (!Number.isInteger(recordId)) return NextResponse.json({ message: "차트번호가 올바르지 않습니다." }, { status: 400 });

  const { data: draft, error } = await supabaseAdmin
    .from("ai_medical_drafts")
    .select("*")
    .eq("medical_record_id", recordId)
    .eq("hospital_id", context.hospitalId)
    .maybeSingle();
  if (error) return NextResponse.json({ message: error.message }, { status: 500 });
  return NextResponse.json({ draft });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ recordId: string }> },
) {
  const limited = enforceRateLimit(request, { scope: "ai-medical-generate", limit: 30, windowMs: 60 * 60_000 });
  if (limited) return limited;

  const context = await requireHospitalContext(request, "write_medical_records");
  if ("error" in context) return NextResponse.json({ message: context.error }, { status: context.status });
  const recordId = Number((await params).recordId);
  if (!Number.isInteger(recordId)) return NextResponse.json({ message: "차트번호가 올바르지 않습니다." }, { status: 400 });

  const { data: record, error: readError } = await readRecord(recordId, context.hospitalId);
  if (readError) return NextResponse.json({ message: readError.message }, { status: 500 });
  if (!record) return NextResponse.json({ message: "차트를 찾을 수 없습니다." }, { status: 404 });

  const pet = Array.isArray(record.pets) ? record.pets[0] : record.pets;
  const generation = await generateMedicalDraft({
    petName: pet?.name,
    species: pet?.species,
    chiefComplaint: record.chief_complaint,
    subjective: record.subjective,
    objective: record.objective,
    assessment: record.assessment,
    plan: record.plan,
    diagnosis: record.diagnosis,
    treatment: record.treatment,
    followUp: record.follow_up,
    prescriptions: (record.medical_prescriptions ?? []).map((item: any) => ({
      medicationName: item.medication_name,
      dosage: item.dosage,
      frequency: item.frequency,
      duration: item.duration,
      route: item.route,
      instructions: item.instructions,
    })),
  });

  const draft = generation.draft;
  const now = new Date().toISOString();
  const { data: saved, error: saveError } = await supabaseAdmin
    .from("ai_medical_drafts")
    .upsert({
      medical_record_id: recordId,
      hospital_id: context.hospitalId,
      pet_id: record.pet_id,
      guardian_summary: draft.guardianSummary,
      care_instructions: draft.careInstructions,
      medication_instructions: draft.medicationInstructions,
      warning_signs: draft.warningSigns,
      next_visit_recommendation: draft.nextVisitRecommendation,
      status: "draft",
      provider: draft.provider,
      model: draft.model,
      generated_by: context.user.id,
      generated_at: now,
      approved_by: null,
      approved_at: null,
      updated_at: now,
    }, { onConflict: "medical_record_id" })
    .select("*")
    .single();
  if (saveError) return NextResponse.json({ message: saveError.message }, { status: 500 });

  await writeAuditLogV2({
    actorUserId: context.user.id,
    actorType: "hospital",
    hospitalId: context.hospitalId,
    action: "ai_medical_draft_generated",
    entityType: "medical_record",
    entityId: recordId,
    extra: {
      provider: draft.provider,
      model: draft.model,
      inputTokens: generation.usage.inputTokens,
      outputTokens: generation.usage.outputTokens,
      totalTokens: generation.usage.totalTokens,
      fallbackReason: generation.fallbackReason,
      cacheHit: generation.cacheHit,
    },
    request,
  });

  await supabaseAdmin.from("ai_medical_usage_logs").insert({
    hospital_id: context.hospitalId,
    medical_record_id: recordId,
    user_id: context.user.id,
    provider: draft.provider,
    model: draft.model,
    response_id: generation.usage.responseId,
    input_tokens: generation.usage.inputTokens,
    output_tokens: generation.usage.outputTokens,
    total_tokens: generation.usage.totalTokens,
    fallback_reason: generation.fallbackReason,
    succeeded: draft.provider === "openai",
  });

  return NextResponse.json({
    draft: saved,
    generation: {
      openAiConfigured: generation.openAiConfigured,
      fallbackReason: generation.fallbackReason,
      usage: generation.usage,
      cacheHit: generation.cacheHit,
    },
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ recordId: string }> },
) {
  const limited = enforceRateLimit(request, { scope: "ai-medical-save", limit: 120, windowMs: 60 * 60_000 });
  if (limited) return limited;

  const context = await requireHospitalContext(request, "write_medical_records");
  if ("error" in context) return NextResponse.json({ message: context.error }, { status: context.status });
  const recordId = Number((await params).recordId);
  const body = await request.json().catch(() => null) as any;
  if (!Number.isInteger(recordId) || !body) return NextResponse.json({ message: "요청이 올바르지 않습니다." }, { status: 400 });

  const status = body.action === "approve" ? "approved" : "draft";
  const now = new Date().toISOString();
  const update = {
    guardian_summary: String(body.guardianSummary ?? ""),
    care_instructions: String(body.careInstructions ?? ""),
    medication_instructions: String(body.medicationInstructions ?? ""),
    warning_signs: String(body.warningSigns ?? ""),
    next_visit_recommendation: String(body.nextVisitRecommendation ?? ""),
    status,
    approved_by: status === "approved" ? context.user.id : null,
    approved_at: status === "approved" ? now : null,
    updated_at: now,
  };

  const { data: draft, error } = await supabaseAdmin
    .from("ai_medical_drafts")
    .update(update)
    .eq("medical_record_id", recordId)
    .eq("hospital_id", context.hospitalId)
    .select("*")
    .maybeSingle();
  if (error) return NextResponse.json({ message: error.message }, { status: 500 });
  if (!draft) return NextResponse.json({ message: "먼저 AI 초안을 생성해 주세요." }, { status: 404 });

  if (status === "approved") {
    const { error: recordError } = await supabaseAdmin
      .from("medical_records")
      .update({
        guardian_summary: update.guardian_summary,
        care_instructions: [update.care_instructions, update.warning_signs ? `주의해서 볼 증상\n${update.warning_signs}` : ""].filter(Boolean).join("\n\n"),
        medication_instructions: update.medication_instructions,
        updated_at: now,
      })
      .eq("id", recordId)
      .eq("hospital_id", context.hospitalId);
    if (recordError) return NextResponse.json({ message: recordError.message }, { status: 500 });
  }

  await writeAuditLogV2({
    actorUserId: context.user.id,
    actorType: "hospital",
    hospitalId: context.hospitalId,
    action: status === "approved" ? "ai_medical_draft_approved" : "ai_medical_draft_saved",
    entityType: "medical_record",
    entityId: recordId,
    extra: { status },
    request,
  });

  return NextResponse.json({ draft, appliedToMedicalRecord: status === "approved" });
}
