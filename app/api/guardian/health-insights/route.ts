import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getOpenAiMedicalConfig } from "@/lib/ai/openai-config";

type InsightResult = {
  overview: string;
  patterns: string[];
  weightNote: string | null;
  upcomingCare: string[];
  questionsForVet: string[];
  provider: "openai" | "template";
  disclaimer: string;
};

function outputText(payload: any) {
  if (typeof payload?.output_text === "string") return payload.output_text;
  for (const item of payload?.output ?? []) for (const content of item?.content ?? []) if (content?.type === "output_text" && typeof content.text === "string") return content.text;
  return "";
}

function fallback(petName: string, records: any): InsightResult {
  const patterns: string[] = [];
  if (records.visits.length) patterns.push(`최근 기록에서 진료 ${records.visits.length}건이 확인됩니다.`);
  if (records.prescriptions.length) patterns.push(`처방 기록 ${records.prescriptions.length}건이 연결되어 있습니다.`);
  if (records.healthEvents.length) patterns.push(`보호자가 남긴 생활·증상 기록 ${records.healthEvents.length}건이 있습니다.`);
  let weightNote: string | null = null;
  if (records.weights.length >= 2) {
    const first = Number(records.weights[0].weight_kg);
    const last = Number(records.weights[records.weights.length - 1].weight_kg);
    weightNote = `${first.toFixed(1)}kg에서 ${last.toFixed(1)}kg으로 ${(last - first) >= 0 ? "+" : ""}${(last - first).toFixed(1)}kg 변화했습니다.`;
  }
  return {
    overview: `${petName}의 PAWU 건강 기록을 항목별로 정리했습니다. 기록이 추가되면 분석 내용도 함께 갱신됩니다.`,
    patterns,
    weightNote,
    upcomingCare: records.followups.map((x: any) => `${x.due_date} · ${x.title || "예정된 관리"}`).slice(0, 5),
    questionsForVet: ["최근 반복된 증상이나 생활 변화가 진료와 관련 있는지 확인해 주세요.", "체중 변화가 적정 범위인지 담당 수의사에게 확인해 주세요."],
    provider: "template",
    disclaimer: "이 내용은 저장된 기록을 정리한 참고 정보이며 진단·처방·응급 판단을 대신하지 않습니다.",
  };
}

export async function POST(request: NextRequest) {
  const token = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  const { data: { user } } = await supabaseAdmin.auth.getUser(token);
  if (!user) return NextResponse.json({ message: "로그인 정보가 유효하지 않습니다." }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const petId = Number(body.petId);
  const { data: pet } = await supabaseAdmin.from("pets").select("id,name,species,breed,birth_date,weight_kg").eq("id", petId).eq("user_id", user.id).maybeSingle();
  if (!pet) return NextResponse.json({ message: "반려동물 정보를 찾을 수 없습니다." }, { status: 404 });

  const [visitsR, prescriptionsR, healthR, weightsR, followupsR] = await Promise.all([
    supabaseAdmin.from("emr_records").select("finalized_at,diagnosis_summary,treatment_summary,guardian_summary,hospitals(name)").eq("pet_id", petId).eq("status", "finalized").order("finalized_at", { ascending: false }).limit(30),
    supabaseAdmin.from("medication_orders").select("finalized_at,diagnosis_summary,guardian_note,medication_order_items(medication_name,frequency,duration_days)").eq("pet_id", petId).eq("status", "finalized").eq("guardian_visible", true).order("finalized_at", { ascending: false }).limit(30),
    supabaseAdmin.from("pet_health_events").select("occurred_at,event_type,severity,title,note,count_value").eq("pet_id", petId).eq("user_id", user.id).order("occurred_at", { ascending: false }).limit(50),
    supabaseAdmin.from("weight_records").select("measured_at,weight_kg,memo").eq("pet_id", petId).eq("user_id", user.id).order("measured_at", { ascending: true }).limit(50),
    supabaseAdmin.from("emr_followups").select("due_date,title,note,status,emr_records!inner(pet_id)").eq("emr_records.pet_id", petId).gte("due_date", new Date().toISOString().slice(0, 10)).order("due_date", { ascending: true }).limit(10),
  ]);
  const records = { visits: visitsR.data || [], prescriptions: prescriptionsR.data || [], healthEvents: healthR.data || [], weights: weightsR.data || [], followups: followupsR.data || [] };
  const base = fallback(pet.name, records);
  const config = getOpenAiMedicalConfig();
  if (!config.enabled || !config.apiKey) return NextResponse.json({ insight: base });

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.timeoutMs);
    const schema = { type: "object", additionalProperties: false, required: ["overview","patterns","weightNote","upcomingCare","questionsForVet"], properties: { overview: { type: "string" }, patterns: { type: "array", items: { type: "string" }, maxItems: 5 }, weightNote: { type: ["string","null"] }, upcomingCare: { type: "array", items: { type: "string" }, maxItems: 5 }, questionsForVet: { type: "array", items: { type: "string" }, maxItems: 5 } } };
    const response = await fetch("https://api.openai.com/v1/responses", { method: "POST", signal: controller.signal, headers: { authorization: `Bearer ${config.apiKey}`, "content-type": "application/json" }, body: JSON.stringify({ model: config.model, store: false, max_output_tokens: 1400, input: [{ role: "system", content: [{ type: "input_text", text: "당신은 반려동물 건강기록 정리 도우미입니다. 입력된 기록만 요약하세요. 새로운 진단, 질환명, 원인, 예후, 처방, 용량, 응급판단을 만들지 마세요. 반복 기록은 사실로 확인되는 범위에서만 표현하고 단정하지 마세요. 보호자가 수의사에게 확인할 질문을 제안하세요. 한국어로 간결하게 작성하세요." }] }, { role: "user", content: [{ type: "input_text", text: JSON.stringify({ pet, records }) }] }], text: { format: { type: "json_schema", name: "pawu_guardian_health_insight", strict: true, schema } } }) });
    clearTimeout(timer);
    if (!response.ok) throw new Error(`OpenAI HTTP ${response.status}`);
    const payload = await response.json();
    const parsed = JSON.parse(outputText(payload));
    const insight: InsightResult = { ...parsed, provider: "openai", disclaimer: base.disclaimer };
    return NextResponse.json({ insight });
  } catch (error) {
    console.error("[health-insights] fallback", error);
    return NextResponse.json({ insight: base });
  }
}
