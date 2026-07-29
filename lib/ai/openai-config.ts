export type OpenAiMedicalConfig = {
  enabled: boolean;
  apiKey: string | null;
  model: string;
  timeoutMs: number;
  maxOutputTokens: number;
};

function intEnv(name: string, fallback: number, min: number, max: number) {
  const parsed = Number(process.env[name]);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(parsed)));
}

export function getOpenAiMedicalConfig(): OpenAiMedicalConfig {
  const apiKey = process.env.OPENAI_API_KEY?.trim() || null;
  const explicitlyDisabled = process.env.OPENAI_MEDICAL_ASSISTANT_ENABLED?.trim().toLowerCase() === "false";

  return {
    enabled: Boolean(apiKey) && !explicitlyDisabled,
    apiKey,
    model: process.env.OPENAI_MEDICAL_ASSISTANT_MODEL?.trim() || "gpt-5-mini",
    timeoutMs: intEnv("OPENAI_MEDICAL_ASSISTANT_TIMEOUT_MS", 30000, 5000, 120000),
    maxOutputTokens: intEnv("OPENAI_MEDICAL_ASSISTANT_MAX_OUTPUT_TOKENS", 1800, 500, 5000),
  };
}
