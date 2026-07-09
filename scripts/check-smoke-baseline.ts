// Phase 7-E (LESSONS-LEARNED 教訓 enforcement):
// smoke 1000 戦の baseline check
//
// 最新 .claude/reports/smoke-YYYY-MM-DD-N.json を読み、baseline と比較。
// - timeouts > 0 → fail
// - exceptions > 0 → fail
// - avg turns delta > ±20% → warn

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const REPORTS_DIR = join(process.cwd(), '.claude', 'reports');
const BASELINE_PATH = join(REPORTS_DIR, 'smoke-baseline.json');

type Baseline = {
  expectations: { matches: number; winsA: number; winsB: number; avgTurns: number };
  thresholds: { timeouts_max: number; exceptions_max: number; avg_turns_delta_pct: number };
};
type SmokeReport = {
  matches: number; winsA: number; winsB: number; timeouts: number; exceptions: number; avgTurns: number;
};

function loadBaseline(): Baseline {
  return JSON.parse(readFileSync(BASELINE_PATH, 'utf-8')) as Baseline;
}
function loadLatestSmoke(): SmokeReport | null {
  // BUG-109 fix: 連番 suffix を numeric で比較する (旧 .sort() は文字列比較で
  // "smoke-...-2.json" > "smoke-...-13.json" となり古い report を最新と誤認していた)。
  // run-1000.ts の初回 report は連番なし (smoke-YYYY-MM-DD.json)、2回目以降 -N 付き。
  // 旧 regex は連番必須で初回 run を見落とし「no smoke report found」誤報 (2026-06-24/06-27/07-02/07-09 再発)。
  const RE = /^smoke-(\d{4}-\d{2}-\d{2})(?:-(\d+))?\.json$/;
  const files = readdirSync(REPORTS_DIR)
    .filter((f) => RE.test(f) && f !== 'smoke-baseline.json')
    .sort((a, b) => {
      const ma = a.match(RE)!;
      const mb = b.match(RE)!;
      if (ma[1] !== mb[1]) return ma[1]! < mb[1]! ? -1 : 1; // 日付は lexical
      return Number(ma[2] ?? 0) - Number(mb[2] ?? 0); // 連番は numeric、なし=0
    });
  if (files.length === 0) return null;
  const latest = files[files.length - 1];
  const raw = JSON.parse(readFileSync(join(REPORTS_DIR, latest), 'utf-8')) as { summary?: Record<string, unknown> };
  const sum = raw.summary ?? {};
  return {
    matches: Number(sum.totalGames ?? 0),
    winsA: Number(sum.winsA ?? 0),
    winsB: Number(sum.winsB ?? 0),
    timeouts: Number(sum.timeouts ?? 0),
    exceptions: Number(sum.exceptions ?? 0),
    avgTurns: Number(sum.avgTurns ?? 0),
  };
}
function main(): void {
  const baseline = loadBaseline();
  const smoke = loadLatestSmoke();
  if (!smoke) {
    console.error('[check-smoke-baseline] no smoke report found. Run `npm run smoke:1000` first.');
    process.exit(1);
  }
  console.log('[check-smoke-baseline]');
  console.log(`  baseline avg=${baseline.expectations.avgTurns} winsA=${baseline.expectations.winsA}`);
  console.log(`  actual   avg=${smoke.avgTurns} winsA=${smoke.winsA} timeouts=${smoke.timeouts} exceptions=${smoke.exceptions}`);
  const errors: string[] = [];
  const warns: string[] = [];
  if (smoke.timeouts > baseline.thresholds.timeouts_max) errors.push(`timeouts=${smoke.timeouts} > max ${baseline.thresholds.timeouts_max}`);
  if (smoke.exceptions > baseline.thresholds.exceptions_max) errors.push(`exceptions=${smoke.exceptions} > max ${baseline.thresholds.exceptions_max}`);
  const deltaPct = baseline.expectations.avgTurns === 0 ? 0
    : Math.abs((smoke.avgTurns - baseline.expectations.avgTurns) / baseline.expectations.avgTurns * 100);
  if (deltaPct > baseline.thresholds.avg_turns_delta_pct) warns.push(`avgTurns delta=${deltaPct.toFixed(1)}% > threshold ${baseline.thresholds.avg_turns_delta_pct}%`);
  for (const e of errors) console.error(`[ERROR] ${e}`);
  for (const w of warns) console.warn(`[WARN]  ${w}`);
  if (errors.length > 0) { console.error('[check-smoke-baseline] FAILED'); process.exit(1); }
  console.log('[check-smoke-baseline] OK');
}
main();
