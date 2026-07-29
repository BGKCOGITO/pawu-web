import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireHospitalContext } from "@/lib/hospital-api-auth";
import { enforceRateLimit } from "@/lib/server/security-policy";
import { writeAuditLogV2 } from "@/lib/server/audit-v2";
import { generatePetMemory, type PetMemoryRecord } from "@/lib/ai/pet-memory";

async function currentPatient(recordId: number, hospitalId: number) {
  return supabaseAdmin
    .from("medical_records")
    .select("id,pet_id,pets(id,name,species,breed)")
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

  const { data: current, error: currentError } = await currentPatient(recordId, context.hospitalId);
  if (currentError) return NextResponse.json({ message: currentError.message }, { status: 500 });
  if (!current?.pet_id) return NextResponse.json({ message: "환자 정보를 찾을 수 없습니다." }, { status: 404 });

  const { data: memory, error } = await supabaseAdmin
    .from("ai_pet_memory_snapshots")
    .select("*")
    .eq("hospital_id", context.hospitalId)
    .eq("pet_id", current.pet_id)
    .maybeSingle();
  if (error) return NextResponse.json({ message: error.message }, { status: 500 });
  return NextResponse.json({ memory });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ recordId: string }> },
) {
  const limited = enforceRateLimit(request, { scope: "ai-pet-memory", limit: 12, windowMs: 60 * 60_000 });
  if (limited) return limited;

  const context = await requireHospitalContext(request, "write_medical_records");
  if ("error" in context) return NextResponse.json({ message: context.error }, { status: context.status });
  const recordId = Number((await params).recordId);
  if (!Number.isInteger(recordId)) return NextResponse.json({ message: "차트번호가 올바르지 않습니다." }, { status: 400 });

  const { data: current, error: currentError } = await currentPatient(recordId, context.hospitalId);
  if (currentError) return NextResponse.json({ message: currentError.message }, { status: 500 });
  if (!current?.pet_id) return NextResponse.json({ message: "환자 정보를 찾을 수 없습니다." }, { status: 404 });
  const petRelation = (current as any).pets;
  const pet = Array.isArray(petRelation) ? petRelation[0] : petRelation;

  const { data: rows, error: historyError } = await supabaseAdmin
    .from("medical_records")
    .select(`
      id,status,created_at,completed_at,chief_complaint,subjective,objective,
      assessment,diagnosis,treatment,plan,follow_up,
      medical_prescriptions(medication_name,dosage,frequency,duration)
    `)
    .eq("hospital_id", context.hospitalId)
    .eq("pet_id", current.pet_id)
    .order("created_at", { ascending: false })
    .limit(50);
  if (historyError) return NextResponse.json({ message: historyError.message }, { status: 500 });

  const records: PetMemoryRecord[] = (rows ?? []).map((row: any) => ({
    id: Number(row.id),
    date: String(row.completed_at ?? row.created_at ?? "").slice(0, 10),
    status: row.status,
    chiefComplaint: row.chief_complaint,
    subjective: row.subjective,
    objective: row.objective,
    assessment: row.assessment,
    diagnosis: row.diagnosis,
    treatment: row.treatment,
    plan: row.plan,
    followUp: row.follow_up,
    prescriptions: (row.medical_prescriptions ?? []).map((item: any) => ({
      medicationName: item.medication_name,
      dosage: item.dosage,
      frequency: item.frequency,
      duration: item.duration,
    })),
  }));

  if (records.length === 0) return NextResponse.json({ message: "정리할 진료기록이 없습니다." }, { status: 400 });

  const generation = await generatePetMemory({
    petName: pet?.name ?? "환자",
    species: pet?.species,
    breed: pet?.breed,
    records,
  });
  const now = new Date().toISOString();
  const { data: saved, error: saveError } = await supabaseAdmin
    .from("ai_pet_memory_snapshots")
    .upsert({
      hospital_id: context.hospitalId,
      pet_id: current.pet_id,
      source_record_id: recordId,
      overview: generation.draft.overview,
      timeline: generation.draft.timeline,
      patterns: generation.draft.patterns,
      cautions: generation.draft.cautions,
      record_count: records.length,
      provider: generation.draft.provider,
      model: generation.draft.model,
      generated_by: context.user.id,
      generated_at: now,
      updated_at: now,
    }, { onConflict: "hospital_id,pet_id" })
    .select("*")
    .single();
  if (saveError) return NextResponse.json({ message: saveError.message }, { status: 500 });

  await writeAuditLogV2({
    request,
    actorUserId: context.user.id,
    actorType: "hospital",
    hospitalId: context.hospitalId,
    action: "ai_pet_memory.generated",
    entityType: "pet",
    entityId: current.pet_id,
    after: { recordCount: records.length, provider: generation.draft.provider },
    extra: {
      sourceRecordId: recordId,
      model: generation.draft.model,
      totalTokens: generation.usage.totalTokens,
      fallbackReason: generation.fallbackReason,
    },
  });

  await supabaseAdmin.from("ai_medical_usage_logs").insert({
    hospital_id: context.hospitalId,
    medical_record_id: recordId,
    user_id: context.user.id,
    provider: generation.draft.provider,
    model: generation.draft.model,
    response_id: generation.usage.responseId,
    input_tokens: generation.usage.inputTokens,
    output_tokens: generation.usage.outputTokens,
    total_tokens: generation.usage.totalTokens,
    fallback_reason: generation.fallbackReason,
    succeeded: generation.draft.provider === "openai",
  });

  return NextResponse.json({
    memory: saved,
    generation: {
      openAiConfigured: generation.openAiConfigured,
      fallbackReason: generation.fallbackReason,
      usage: generation.usage,
    },
  });
}
