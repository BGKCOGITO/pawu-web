const required = ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"];
const missing = required.filter((name) => !process.env[name]?.trim());
if (missing.length) {
  console.error(`\n[PAWU VERIFY] 필수 환경변수 누락: ${missing.join(", ")}\n`);
  process.exit(1);
}
console.log("[PAWU VERIFY] 필수 환경변수 확인 완료");
if (!process.env.OPENAI_API_KEY?.trim()) {
  console.warn("[PAWU VERIFY] OPENAI_API_KEY 없음: AI는 템플릿 fallback 모드로 동작합니다.");
}
