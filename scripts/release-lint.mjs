import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const result = spawnSync("npx", ["eslint", ".", "--format", "json"], {
  cwd: process.cwd(),
  encoding: "utf8",
  shell: process.platform === "win32",
  env: process.env,
  maxBuffer: 1024 * 1024 * 50,
});

if (result.error) {
  console.error("ESLint 실행 실패:", result.error.message);
  process.exit(1);
}

let files;
try {
  files = JSON.parse(result.stdout || "[]");
} catch {
  console.error("ESLint 결과를 읽지 못했습니다.");
  if (result.stdout) console.error(result.stdout);
  if (result.stderr) console.error(result.stderr);
  process.exit(1);
}

const messages = files.flatMap((file) =>
  (file.messages ?? []).map((message) => ({
    filePath: file.filePath,
    ...message,
  })),
);

const fatal = messages.filter((message) => message.fatal || message.ruleId === null);
const errors = messages.filter((message) => message.severity === 2 && !message.fatal);
const warnings = messages.filter((message) => message.severity === 1);
const fixable = messages.filter((message) => message.fix).length;

const byRule = new Map();
for (const message of messages) {
  const rule = message.ruleId ?? "parser/fatal";
  byRule.set(rule, (byRule.get(rule) ?? 0) + 1);
}

const topRules = [...byRule.entries()]
  .sort((a, b) => b[1] - a[1])
  .slice(0, 12)
  .map(([rule, count]) => ({ rule, count }));

const report = {
  generatedAt: new Date().toISOString(),
  filesWithMessages: files.filter((file) => (file.messages?.length ?? 0) > 0).length,
  errors: errors.length,
  warnings: warnings.length,
  fatal: fatal.length,
  fixable,
  topRules,
};

const reportsDir = join(process.cwd(), "release", "reports");
mkdirSync(reportsDir, { recursive: true });
writeFileSync(join(reportsDir, "eslint-baseline.json"), JSON.stringify(report, null, 2) + "\n");

console.log(`ESLint 기준선: ERROR ${errors.length} / WARN ${warnings.length} / FATAL ${fatal.length}`);
if (topRules.length > 0) {
  console.log("주요 항목:");
  for (const item of topRules) console.log(`- ${item.rule}: ${item.count}`);
}
console.log(`자동 수정 가능: ${fixable}건`);

if (fatal.length > 0) {
  console.error("파서 오류 또는 치명적 ESLint 오류가 있어 출시 검사를 중단합니다.");
  for (const item of fatal.slice(0, 20)) {
    console.error(`${item.filePath}:${item.line ?? 0}:${item.column ?? 0} ${item.message}`);
  }
  process.exit(1);
}

if (errors.length > 0 || warnings.length > 0) {
  console.warn(
    "기존 코드의 ESLint 기술 부채는 기준선 보고서에 기록했습니다. " +
      "RC1에서는 TypeScript와 Production Build를 출시 차단 기준으로 사용합니다.",
  );
}

process.exit(0);
