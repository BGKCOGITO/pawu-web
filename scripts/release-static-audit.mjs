import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = process.cwd();
const pass = [];
const warn = [];
const fail = [];

function check(label, condition, detail = "") {
  (condition ? pass : fail).push({ label, detail });
}
function walk(dir, output = []) {
  if (!existsSync(dir)) return output;
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    const st = statSync(path);
    if (st.isDirectory()) walk(path, output);
    else output.push(path);
  }
  return output;
}

const requiredPaths = [
  "app/api/health/route.ts",
  "app/hospital-admin/emr/page.tsx",
  "app/hospital-admin/inpatients/page.tsx",
  "app/admin/system-status/page.tsx",
  "lib/server/hospital-guard.ts",
  "lib/server/rate-limit.ts",
  "lib/server/audit-v2.ts",
  "lib/ops/system-monitor.ts",
  "supabase",
];
for (const item of requiredPaths) check(`필수 경로: ${item}`, existsSync(join(root, item)));

const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
check("프로젝트 버전", /^1\.0\.0-rc\d+$/.test(pkg.version), `현재: ${pkg.version}`);
check("release:check 명령", Boolean(pkg.scripts?.["release:check"]));
check("typecheck 명령", Boolean(pkg.scripts?.typecheck));
check("build 명령", Boolean(pkg.scripts?.build));

const routeFiles = walk(join(root, "app/api")).filter((p) => p.endsWith("route.ts"));
check("API Route 발견", routeFiles.length > 0, `${routeFiles.length}개`);

const mutationRoutes = [];
for (const path of routeFiles) {
  const source = readFileSync(path, "utf8");
  if (/export\s+async\s+function\s+(POST|PUT|PATCH|DELETE)/.test(source)) mutationRoutes.push(path);
}
check("변경형 API 존재 확인", mutationRoutes.length > 0, `${mutationRoutes.length}개`);

const suspicious = mutationRoutes.filter((path) => {
  const source = readFileSync(path, "utf8");
  return !/(getUser\(|auth\.getUser|requireHospital|require.*Permission|Authorization|verify)/i.test(source);
});
if (suspicious.length) {
  warn.push({
    label: "권한 확인 문자열이 감지되지 않은 변경형 API",
    detail: suspicious.slice(0, 20).map((p) => relative(root, p)).join(", ") + (suspicious.length > 20 ? ` 외 ${suspicious.length - 20}개` : ""),
  });
}

const backupFiles = walk(root).filter((p) => /(?:\.bak$|\.backup-|\.before-)/i.test(p));
if (backupFiles.length) warn.push({ label: "프로젝트 내부 백업 파일", detail: `${backupFiles.length}개 (빌드 대상에서 제외 권장)` });

const secretPatterns = [
  /sk-proj-[A-Za-z0-9_-]{20,}/,
  /eyJ[A-Za-z0-9_-]{80,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/,
];
const textFiles = walk(root).filter((p) => /\.(ts|tsx|js|mjs|json|md|env|txt)$/i.test(p) && !p.includes("node_modules") && !p.endsWith("release-static-audit.mjs"));
let secretHits = [];
for (const path of textFiles) {
  if (statSync(path).size > 1_000_000) continue;
  const source = readFileSync(path, "utf8");
  if (secretPatterns.some((re) => re.test(source))) secretHits.push(relative(root, path));
}
check("소스 내 명백한 비밀키 미검출", secretHits.length === 0, secretHits.join(", "));

console.log(`\nPAWU ${pkg.version} 정적 릴리즈 점검\n`);
for (const item of pass) console.log(`PASS  ${item.label}${item.detail ? ` · ${item.detail}` : ""}`);
for (const item of warn) console.warn(`WARN  ${item.label}${item.detail ? ` · ${item.detail}` : ""}`);
for (const item of fail) console.error(`FAIL  ${item.label}${item.detail ? ` · ${item.detail}` : ""}`);
console.log(`\n결과: PASS ${pass.length} / WARN ${warn.length} / FAIL ${fail.length}\n`);
if (fail.length) process.exit(1);
