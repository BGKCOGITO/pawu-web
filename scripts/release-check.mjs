import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { readFileSync } from "node:fs";

const startedAt = new Date();
const packageJson = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8"));
const steps = [
  ["환경변수", "npm", ["run", "verify:env"]],
  ["정적 점검", "npm", ["run", "release:static"]],
  ["TypeScript", "npm", ["run", "typecheck"]],
  ["ESLint 기준선", "npm", ["run", "release:lint"]],
  ["Production Build", "npm", ["run", "build"]],
];
const results = [];

for (const [name, command, args] of steps) {
  console.log(`\n========== ${name} ==========`);
  const started = Date.now();
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    stdio: "inherit",
    shell: process.platform === "win32",
    env: process.env,
  });
  const ok = result.status === 0;
  results.push({ name, ok, exitCode: result.status ?? -1, durationMs: Date.now() - started });
  if (!ok) break;
}

const finishedAt = new Date();
const report = {
  release: packageJson.version,
  startedAt: startedAt.toISOString(),
  finishedAt: finishedAt.toISOString(),
  success: results.every((r) => r.ok) && results.length === steps.length,
  results,
};
mkdirSync(join(process.cwd(), "release", "reports"), { recursive: true });
const stamp = finishedAt.toISOString().replace(/[:.]/g, "-");
const path = join(process.cwd(), "release", "reports", `release-check-${stamp}.json`);
writeFileSync(path, JSON.stringify(report, null, 2) + "\n");
console.log(`\n릴리즈 점검 보고서: ${path}`);
console.log(report.success ? "\nPAWU RELEASE CHECK: PASS\n" : "\nPAWU RELEASE CHECK: FAIL\n");
process.exit(report.success ? 0 : 1);
