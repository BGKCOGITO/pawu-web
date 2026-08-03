import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const failures = [];
const warnings = [];
const passes = [];

function pass(label) {
  passes.push(label);
}

function fail(label, detail = "") {
  failures.push({ label, detail });
}

function warn(label, detail = "") {
  warnings.push({ label, detail });
}

function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) fail(`환경변수 ${name}`, "값이 없습니다.");
  else pass(`환경변수 ${name}`);
  return value;
}

const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
if (/^10\.0\.0-rc\.\d+$/.test(packageJson.version)) pass(`RC 버전 ${packageJson.version}`);
else fail("RC 버전 형식", `현재 버전: ${packageJson.version}`);

for (const file of ["PAWU_MASTER.md", "PROJECT_STATUS.md", "CHANGELOG.md", "RELEASE-CHECKLIST-V10-RC.md"]) {
  if (existsSync(join(root, file))) pass(`문서 ${file}`);
  else fail(`문서 ${file}`, "파일이 없습니다.");
}

const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
requireEnv("SUPABASE_SERVICE_ROLE_KEY");
requireEnv("NEXT_PUBLIC_FIREBASE_API_KEY");
requireEnv("NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN");
requireEnv("NEXT_PUBLIC_FIREBASE_PROJECT_ID");
requireEnv("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET");
requireEnv("NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID");
requireEnv("NEXT_PUBLIC_FIREBASE_APP_ID");
requireEnv("NEXT_PUBLIC_FIREBASE_VAPID_KEY");
const firebaseServiceAccount = requireEnv("FIREBASE_SERVICE_ACCOUNT_JSON");

if (supabaseUrl && /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(supabaseUrl)) {
  pass("Supabase URL 형식");
} else if (supabaseUrl) {
  fail("Supabase URL 형식", "https://PROJECT_REF.supabase.co 형식인지 확인하세요.");
}

if (firebaseServiceAccount) {
  try {
    const parsed = JSON.parse(firebaseServiceAccount);
    const requiredKeys = ["project_id", "private_key", "client_email"];
    const missing = requiredKeys.filter((key) => !parsed?.[key]);
    if (missing.length) fail("Firebase 서비스 계정 JSON", `누락 필드: ${missing.join(", ")}`);
    else pass("Firebase 서비스 계정 JSON");
  } catch (error) {
    fail("Firebase 서비스 계정 JSON", error instanceof Error ? error.message : String(error));
  }
}

for (const name of ["SOLAPI_API_KEY", "SOLAPI_API_SECRET", "SOLAPI_SENDER_NUMBER"]) {
  if (process.env[name]?.trim()) pass(`선택 환경변수 ${name}`);
  else warn(`선택 환경변수 ${name}`, "문자 인증을 운영하면 등록이 필요합니다.");
}

console.log(`\nPAWU ${packageJson.version} 출시 준비 점검\n`);
for (const label of passes) console.log(`PASS  ${label}`);
for (const item of warnings) console.warn(`WARN  ${item.label}${item.detail ? ` · ${item.detail}` : ""}`);
for (const item of failures) console.error(`FAIL  ${item.label}${item.detail ? ` · ${item.detail}` : ""}`);
console.log(`\n결과: PASS ${passes.length} / WARN ${warnings.length} / FAIL ${failures.length}\n`);
process.exit(failures.length ? 1 : 0);
