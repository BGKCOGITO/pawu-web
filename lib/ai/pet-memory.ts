import { getOpenAiMedicalConfig } from "@/lib/ai/openai-config";

export type PetMemoryRecord = {
  id: number;
  date: string;
  status?: string | null;
  chiefComplaint?: string | null;
  subjective?: string | null;
  objective?: string | null;
  assessment?: string | null;
  diagnosis?: string | null;
  treatment?: string | null;
  plan?: string | null;
  followUp?: string | null;
  prescriptions?: Array<{
    medicationName?: string | null;
    dosage?: string | null;
    frequency?: string | null;
    duration?: string | null;
  }>;
};

export type PetMemoryInput = {
  petName: string;
  species?: string | null;
  breed?: string | null;
  records: PetMemoryRecord[];
};

export type PetMemoryTimelineItem = {
  date: string;
  title: string;
  detail: string;
  recordId: number;
};

export type PetMemoryPattern = {
  label: string;
  evidence: string;
  recordIds: number[];
};

export type PetMemoryDraft = {
  overview: string;
  timeline: PetMemoryTimelineItem[];
  patterns: PetMemoryPattern[];
  cautions: string[];
  provider: "template" | "openai";
  model: string | null;
};

export type PetMemoryGeneration = {
  draft: PetMemoryDraft;
  usage: {
    inputTokens: number | null;
    outputTokens: number | null;
    totalTokens: number | null;
    responseId: string | null;
  };
  fallbackReason: string | null;
  openAiConfigured: boolean;
};

function clean(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function recordTitle(record: PetMemoryRecord) {
  return clean(record.diagnosis) || clean(record.chiefComplaint) || clean(record.assessment) || "진료 기록";
}

function recordDetail(record: PetMemoryRecord) {
  return [
    clean(record.chiefComplaint) ? `주호소: ${clean(record.chiefComplaint)}` : "",
    clean(record.diagnosis) ? `기록된 진단: ${clean(record.diagnosis)}` : "",
    clean(record.treatment) ? `처치: ${clean(record.treatment)}` : "",
    clean(record.followUp) ? `추적관리: ${clean(record.followUp)}` : "",
  ].filter(Boolean).join(" · ").slice(0, 700);
}

function normalizePattern(value: string) {
  return value.toLowerCase().replace(/[\s,./()\[\]{}:;_-]+/g, "").slice(0, 120);
}

export function buildTemplatePetMemory(input: PetMemoryInput): PetMemoryDraft {
  const ordered = [...input.records].sort((a, b) => b.date.localeCompare(a.date));
  const timeline = ordered.slice(0, 20).map((record) => ({
    date: record.date,
    title: recordTitle(record),
    detail: recordDetail(record) || "세부 기록은 해당 전자차트에서 확인해 주세요.",
    recordId: record.id,
  }));

  const groups = new Map<string, { label: string; ids: number[]; dates: string[] }>();
  for (const record of ordered) {
    const candidate = clean(record.diagnosis) || clean(record.chiefComplaint);
    if (!candidate) continue;
    const key = normalizePattern(candidate);
    if (!key) continue;
    const current = groups.get(key) ?? { label: candidate, ids: [], dates: [] };
    current.ids.push(record.id);
    current.dates.push(record.date);
    groups.set(key, current);
  }

  const patterns = [...groups.values()]
    .filter((group) => group.ids.length >= 2)
    .sort((a, b) => b.ids.length - a.ids.length)
    .slice(0, 8)
    .map((group) => ({
      label: `${group.label} 관련 기록 반복`,
      evidence: `${group.ids.length}회 기록됨 · ${group.dates.slice(0, 5).join(", ")}`,
      recordIds: group.ids,
    }));

  return {
    overview: `${input.petName}의 현재 병원 내 진료기록 ${ordered.length}건을 시간순으로 정리했습니다. 아래 내용은 기록된 사실을 빠르게 찾기 위한 참고자료이며 새로운 진단이나 치료 권고가 아닙니다.`,
    timeline,
    patterns,
    cautions: [
      "반복 표시는 동일하거나 매우 유사하게 입력된 기록을 묶은 것으로 질환 재발을 확정하지 않습니다.",
      "다른 병원 기록과 보호자가 별도로 보관한 자료는 포함되지 않을 수 있습니다.",
      "의료 판단 전에는 반드시 원본 차트, 검사 결과와 현재 환자 상태를 직접 확인해 주세요.",
    ],
    provider: "template",
    model: null,
  };
}

const schema = {
  type: "object",
  additionalProperties: false,
  properties: {
    overview: { type: "string" },
    timeline: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          date: { type: "string" },
          title: { type: "string" },
          detail: { type: "string" },
          recordId: { type: "integer" },
        },
        required: ["date", "title", "detail", "recordId"],
      },
    },
    patterns: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          label: { type: "string" },
          evidence: { type: "string" },
          recordIds: { type: "array", items: { type: "integer" } },
        },
        required: ["label", "evidence", "recordIds"],
      },
    },
    cautions: { type: "array", items: { type: "string" } },
  },
  required: ["overview", "timeline", "patterns", "cautions"],
};

function outputText(payload: any): string {
  if (typeof payload?.output_text === "string" && payload.output_text.trim()) return payload.output_text;
  const values: string[] = [];
  for (const item of payload?.output ?? []) {
    for (const content of item?.content ?? []) {
      if (typeof content?.text === "string") values.push(content.text);
    }
  }
  return values.join("\n");
}

function safeReason(error: unknown) {
  if (error instanceof Error) {
    if (error.name === "AbortError") return "OpenAI 응답 제한 시간을 초과했습니다.";
    return error.message.slice(0, 500);
  }
  return "OpenAI 호출 중 알 수 없는 오류가 발생했습니다.";
}

export async function generatePetMemory(input: PetMemoryInput): Promise<PetMemoryGeneration> {
  const config = getOpenAiMedicalConfig();
  const fallback = buildTemplatePetMemory(input);
  const emptyUsage = { inputTokens: null, outputTokens: null, totalTokens: null, responseId: null };

  if (!config.enabled || !config.apiKey) {
    return {
      draft: fallback,
      usage: emptyUsage,
      fallbackReason: config.apiKey ? "OpenAI 의료보조 기능이 비활성화되어 있습니다." : "OpenAI API 키가 설정되지 않았습니다.",
      openAiConfigured: Boolean(config.apiKey),
    };
  }

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
        max_output_tokens: Math.min(config.maxOutputTokens, 2200),
        store: false,
        input: [
          {
            role: "system",
            content: [{
              type: "input_text",
              text: [
                "당신은 한국 동물병원의 과거 의료기록 정리 보조 도구입니다.",
                "제공된 기록에 명시된 사실만 사용해 의료진용 타임라인과 반복 기록을 정리하세요.",
                "새로운 진단, 감별진단, 원인, 위험도, 예후, 검사 또는 치료 권고를 만들지 마세요.",
                "패턴은 동일하거나 유사한 주호소·진단이 여러 기록에 실제로 존재할 때만 표시하세요.",
                "각 패턴에는 근거가 된 recordId만 넣으세요.",
                "불명확한 내용은 단정하지 말고 원본 차트 확인이 필요하다고 표현하세요.",
                "timeline은 최근 기록부터 최대 20건만 작성하세요.",
                "이 결과는 보호자 공개용이 아니라 의료진 참고자료입니다.",
                "반드시 지정된 JSON 구조로만 응답하세요.",
              ].join("\n"),
            }],
          },
          {
            role: "user",
            content: [{ type: "input_text", text: JSON.stringify(input) }],
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "pawu_pet_medical_memory",
            strict: true,
            schema,
          },
        },
      }),
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok) throw new Error(payload?.error?.message || `OpenAI HTTP ${response.status}`);
    const raw = outputText(payload);
    if (!raw) throw new Error("OpenAI 응답이 비어 있습니다.");
    const parsed = JSON.parse(raw) as Omit<PetMemoryDraft, "provider" | "model">;
    const allowedIds = new Set(input.records.map((record) => record.id));

    const timeline = (parsed.timeline ?? [])
      .filter((item) => allowedIds.has(Number(item.recordId)))
      .slice(0, 20)
      .map((item) => ({
        date: clean(item.date),
        title: clean(item.title),
        detail: clean(item.detail),
        recordId: Number(item.recordId),
      }));

    const patterns = (parsed.patterns ?? [])
      .map((item) => ({
        label: clean(item.label),
        evidence: clean(item.evidence),
        recordIds: (item.recordIds ?? []).map(Number).filter((id) => allowedIds.has(id)),
      }))
      .filter((item) => item.label && item.recordIds.length >= 2)
      .slice(0, 8);

    return {
      draft: {
        overview: clean(parsed.overview) || fallback.overview,
        timeline: timeline.length ? timeline : fallback.timeline,
        patterns,
        cautions: (parsed.cautions ?? []).map(clean).filter(Boolean).slice(0, 6),
        provider: "openai",
        model: config.model,
      },
      usage: {
        inputTokens: Number.isFinite(payload?.usage?.input_tokens) ? payload.usage.input_tokens : null,
        outputTokens: Number.isFinite(payload?.usage?.output_tokens) ? payload.usage.output_tokens : null,
        totalTokens: Number.isFinite(payload?.usage?.total_tokens) ? payload.usage.total_tokens : null,
        responseId: typeof payload?.id === "string" ? payload.id : null,
      },
      fallbackReason: null,
      openAiConfigured: true,
    };
  } catch (error) {
    console.error("PAWU AI Memory fallback:", error);
    return {
      draft: fallback,
      usage: emptyUsage,
      fallbackReason: safeReason(error),
      openAiConfigured: true,
    };
  } finally {
    clearTimeout(timeout);
  }
}
