import { getOpenAiMedicalConfig } from "@/lib/ai/openai-config";
import type { MedicalAssistantDraft, MedicalAssistantInput } from "@/lib/ai/medical-assistant";

export type OpenAiUsage = {
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  responseId: string | null;
};

export type OpenAiMedicalResult = {
  draft: MedicalAssistantDraft;
  usage: OpenAiUsage;
};

const disclaimer =
  "이 안내는 담당 의료진이 작성한 진료기록을 보호자가 이해하기 쉽게 정리한 초안입니다. 새로운 진단이나 처방을 의미하지 않으며, 반드시 담당 의료진의 검토와 승인을 거쳐야 합니다.";

const schema = {
  type: "object",
  additionalProperties: false,
  properties: {
    guardianSummary: { type: "string" },
    careInstructions: { type: "string" },
    medicationInstructions: { type: "string" },
    warningSigns: { type: "string" },
    nextVisitRecommendation: { type: "string" },
  },
  required: [
    "guardianSummary",
    "careInstructions",
    "medicationInstructions",
    "warningSigns",
    "nextVisitRecommendation",
  ],
};

function outputText(payload: any): string {
  if (typeof payload?.output_text === "string" && payload.output_text.trim()) return payload.output_text;
  const parts: string[] = [];
  for (const item of payload?.output ?? []) {
    for (const content of item?.content ?? []) {
      if (typeof content?.text === "string") parts.push(content.text);
    }
  }
  return parts.join("\n");
}

function asText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function generateWithOpenAi(input: MedicalAssistantInput): Promise<OpenAiMedicalResult> {
  const config = getOpenAiMedicalConfig();
  if (!config.enabled || !config.apiKey) throw new Error("OPENAI_NOT_CONFIGURED");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      signal: controller.signal,
      headers: {
        authorization: `Bearer ${config.apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: config.model,
        max_output_tokens: config.maxOutputTokens,
        store: false,
        input: [
          {
            role: "system",
            content: [
              {
                type: "input_text",
                text: [
                  "당신은 한국 동물병원의 의료문서 설명 보조 도구입니다.",
                  "입력된 의료진 기록만 사용해 보호자가 이해하기 쉬운 한국어 초안을 작성하세요.",
                  "새로운 진단, 검사결과, 처방, 용량, 예후 또는 응급기준을 만들어내지 마세요.",
                  "의심·가능성·계획 등 원문의 불확실성을 그대로 유지하세요.",
                  "약품 안내는 입력된 약명과 복용법만 정리하고 일반 지식을 덧붙이지 마세요.",
                  "warningSigns에는 기록에 명시된 경고 증상만 작성하세요. 없으면 담당 의료진 확인 필요라고 작성하세요.",
                  "nextVisitRecommendation에는 기록에 적힌 재진 일정만 작성하세요. 없으면 담당 의료진이 확정해야 한다고 작성하세요.",
                  `guardianSummary 끝에는 반드시 다음 취지의 문구를 포함하세요: ${disclaimer}`,
                  "반드시 지정된 JSON 구조로만 응답하세요.",
                ].join("\n"),
              },
            ],
          },
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: JSON.stringify(input),
              },
            ],
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "pawu_medical_guardian_draft",
            strict: true,
            schema,
          },
        },
      }),
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const detail = payload?.error?.message || `HTTP ${response.status}`;
      throw new Error(`OPENAI_REQUEST_FAILED: ${detail}`);
    }

    const raw = outputText(payload);
    if (!raw) throw new Error("OPENAI_EMPTY_RESPONSE");
    const parsed = JSON.parse(raw) as Record<string, unknown>;

    const draft: MedicalAssistantDraft = {
      guardianSummary: asText(parsed.guardianSummary),
      careInstructions: asText(parsed.careInstructions),
      medicationInstructions: asText(parsed.medicationInstructions),
      warningSigns: asText(parsed.warningSigns),
      nextVisitRecommendation: asText(parsed.nextVisitRecommendation),
      provider: "openai",
      model: config.model,
    };

    if (!draft.guardianSummary) throw new Error("OPENAI_INVALID_RESPONSE");

    const usage = payload?.usage ?? {};
    return {
      draft,
      usage: {
        inputTokens: Number.isFinite(usage.input_tokens) ? usage.input_tokens : null,
        outputTokens: Number.isFinite(usage.output_tokens) ? usage.output_tokens : null,
        totalTokens: Number.isFinite(usage.total_tokens) ? usage.total_tokens : null,
        responseId: typeof payload?.id === "string" ? payload.id : null,
      },
    };
  } finally {
    clearTimeout(timeout);
  }
}
