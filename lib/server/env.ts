export type EnvironmentCheck = {
  ok: boolean;
  missing: string[];
  warnings: string[];
};

const REQUIRED_SERVER_ENV = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
] as const;

const RECOMMENDED_SERVER_ENV = [
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
] as const;

export function checkServerEnvironment(): EnvironmentCheck {
  const missing = REQUIRED_SERVER_ENV.filter((name) => !process.env[name]?.trim());
  const warnings = RECOMMENDED_SERVER_ENV
    .filter((name) => !process.env[name]?.trim())
    .map((name) => `${name} 환경변수가 설정되지 않았습니다.`);

  if (process.env.OPENAI_MEDICAL_ASSISTANT_ENABLED?.toLowerCase() !== "false" && !process.env.OPENAI_API_KEY?.trim()) {
    warnings.push("OPENAI_API_KEY가 없어 AI 의료보조가 템플릿 모드로 동작합니다.");
  }

  return { ok: missing.length === 0, missing: [...missing], warnings };
}

export function assertServerEnvironment() {
  const result = checkServerEnvironment();
  if (!result.ok) {
    throw new Error(`필수 서버 환경변수가 없습니다: ${result.missing.join(", ")}`);
  }
  return result;
}
