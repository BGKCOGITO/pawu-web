import { generateWithOpenAi, type OpenAiUsage } from "@/lib/ai/openai-medical-provider";
import { getOpenAiMedicalConfig } from "@/lib/ai/openai-config";
import { getPendingMedicalDraft, medicalDraftCacheKey, readMedicalDraftCache, setPendingMedicalDraft, writeMedicalDraftCache } from "@/lib/ai/medical-draft-cache";

export type MedicalAssistantInput = {
  petName?: string | null;
  species?: string | null;
  chiefComplaint?: string | null;
  subjective?: string | null;
  objective?: string | null;
  assessment?: string | null;
  plan?: string | null;
  diagnosis?: string | null;
  treatment?: string | null;
  followUp?: string | null;
  prescriptions?: Array<{
    medicationName?: string | null;
    dosage?: string | null;
    frequency?: string | null;
    duration?: string | null;
    route?: string | null;
    instructions?: string | null;
  }>;
};

export type MedicalAssistantDraft = {
  guardianSummary: string;
  careInstructions: string;
  medicationInstructions: string;
  warningSigns: string;
  nextVisitRecommendation: string;
  provider: "template" | "openai";
  model?: string | null;
};

export type MedicalAssistantGeneration = {
  draft: MedicalAssistantDraft;
  usage: OpenAiUsage;
  fallbackReason: string | null;
  openAiConfigured: boolean;
  cacheHit: boolean;
};

const disclaimer =
  "이 안내는 담당 의료진이 작성한 진료기록을 보호자가 이해하기 쉽게 정리한 초안입니다. 새로운 진단이나 처방을 의미하지 않으며, 반드시 담당 의료진의 검토와 승인을 거쳐야 합니다.";

function clean(value?: string | null) {
  return String(value ?? "").trim();
}

export function buildTemplateMedicalDraft(input: MedicalAssistantInput): MedicalAssistantDraft {
  const petName = clean(input.petName) || "반려동물";
  const diagnosis = clean(input.diagnosis) || clean(input.assessment);
  const treatment = clean(input.treatment) || clean(input.plan);
  const complaint = clean(input.chiefComplaint) || clean(input.subjective);
  const followUp = clean(input.followUp);

  const summaryParts = [
    `${petName}의 오늘 진료 내용을 안내드립니다.`,
    complaint ? `내원 이유 및 보호자 말씀: ${complaint}` : "",
    diagnosis ? `담당 의료진의 진료 소견: ${diagnosis}` : "",
    treatment ? `오늘 시행하거나 계획한 치료: ${treatment}` : "",
    disclaimer,
  ].filter(Boolean);

  const careParts = [
    clean(input.plan) ? `생활 관리 및 치료 계획: ${clean(input.plan)}` : "",
    followUp ? `추적 관리: ${followUp}` : "",
    "식욕, 물 섭취, 활동량, 배변·배뇨 상태를 평소와 비교해 관찰해 주세요.",
    "상태가 갑자기 악화되거나 안내받지 않은 새로운 증상이 나타나면 병원에 연락해 주세요.",
  ].filter(Boolean);

  const prescriptions = input.prescriptions ?? [];
  const medicationParts = prescriptions.length
    ? prescriptions.map((item, index) => {
        const detail = [
          clean(item.dosage),
          clean(item.frequency),
          clean(item.duration),
          clean(item.route),
        ].filter(Boolean).join(" · ");
        const instruction = clean(item.instructions);
        return `${index + 1}. ${clean(item.medicationName) || "처방약"}${detail ? ` — ${detail}` : ""}${instruction ? `\n   복약 안내: ${instruction}` : ""}`;
      })
    : ["등록된 처방약이 없습니다. 처방이 추가되면 의료진이 복약 방법을 확인해 주세요."];

  const warningSigns = [
    "호흡이 힘들어 보이거나 의식 저하·경련이 나타나는 경우",
    "반복되는 구토, 심한 설사, 출혈 또는 극심한 통증이 있는 경우",
    "물을 전혀 마시지 못하거나 소변을 보지 못하는 경우",
    "담당 의료진이 별도로 안내한 증상이 나타나는 경우",
  ].map((value) => `• ${value}`).join("\n");

  return {
    guardianSummary: summaryParts.join("\n\n"),
    careInstructions: careParts.map((value) => `• ${value}`).join("\n"),
    medicationInstructions: medicationParts.join("\n\n"),
    warningSigns,
    nextVisitRecommendation: followUp || "담당 의료진이 환자 상태에 따라 재진 시점을 확정해 주세요.",
    provider: "template",
    model: null,
  };
}

function emptyUsage(): OpenAiUsage {
  return { inputTokens: null, outputTokens: null, totalTokens: null, responseId: null };
}

function safeReason(error: unknown) {
  if (error instanceof Error) {
    if (error.name === "AbortError") return "OpenAI 응답 제한 시간을 초과했습니다.";
    if (error.message === "OPENAI_NOT_CONFIGURED") return "OpenAI API 키가 설정되지 않았습니다.";
    return error.message.slice(0, 500);
  }
  return "OpenAI 호출 중 알 수 없는 오류가 발생했습니다.";
}

export async function generateMedicalDraft(input: MedicalAssistantInput): Promise<MedicalAssistantGeneration> {
  const config = getOpenAiMedicalConfig();
  if (!config.enabled) {
    return {
      draft: buildTemplateMedicalDraft(input),
      usage: emptyUsage(),
      fallbackReason: config.apiKey ? "OpenAI 의료보조 기능이 환경설정에서 비활성화되어 있습니다." : "OpenAI API 키가 설정되지 않았습니다.",
      openAiConfigured: Boolean(config.apiKey),
      cacheHit: false,
    };
  }

  const cacheKey = medicalDraftCacheKey(input, config.model);
  const cached = readMedicalDraftCache(cacheKey);
  if (cached) return { ...cached, usage: emptyUsage(), cacheHit: true };

  const existing = getPendingMedicalDraft(cacheKey);
  if (existing) {
    const shared = await existing;
    return { ...shared, usage: emptyUsage(), cacheHit: true };
  }

  const generation = (async (): Promise<MedicalAssistantGeneration> => {
    try {
      const result = await generateWithOpenAi(input);
      return {
        draft: result.draft,
        usage: result.usage,
        fallbackReason: null,
        openAiConfigured: true,
        cacheHit: false,
      };
    } catch (error) {
      console.error("OpenAI medical assistant fallback:", error);
      return {
        draft: buildTemplateMedicalDraft(input),
        usage: emptyUsage(),
        fallbackReason: safeReason(error),
        openAiConfigured: true,
        cacheHit: false,
      };
    }
  })();

  setPendingMedicalDraft(cacheKey, generation);
  const result = await generation;
  if (result.draft.provider === "openai") writeMedicalDraftCache(cacheKey, result);
  return result;
}
