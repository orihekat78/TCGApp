// Phase 8-1: test coverage threshold check
// vitest --coverage 実行後の coverage-summary.json と baseline を比較

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const REPORTS_DIR = join(process.cwd(), '.claude', 'reports');
const SUMMARY_PATH = join(REPORTS_DIR, 'coverage', 'coverage-summary.json');
const BASELINE_PATH = join(REPORTS_DIR, 'coverage-baseline.json');

type Baseline = {
  thresholds: { lines_min_pct: number; branches_min_pct: number; functions_min_pct: number; statements_min_pct: number };
};
type CoverageSummary = {
  total: {
    lines: { pct: number };
    branches: { pct: number };
    functions: { pct: number };
    statements: { pct: number };
  };
};

function main(): void {
  if (!existsSync(SUMMARY_PATH)) {
    console.error(`[check-coverage] coverage-summary.json not found at ${SUMMARY_PATH}`);
    console.error('  Run `npm run test:coverage` first.');
    process.exit(1);
  }
  const summary = JSON.parse(readFileSync(SUMMARY_PATH, 'utf-8')) as CoverageSummary;
  const baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf-8')) as Baseline;
  const t = baseline.thresholds;
  const actual = {
    lines: summary.total.lines.pct,
    branches: summary.total.branches.pct,
    functions: summary.total.functions.pct,
    statements: summary.total.statements.pct,
  };
  console.log('[check-coverage]');
  console.log(`  lines:      ${actual.lines.toFixed(2)}% (threshold ${t.lines_min_pct}%)`);
  console.log(`  branches:   ${actual.branches.toFixed(2)}% (threshold ${t.branches_min_pct}%)`);
  console.log(`  functions:  ${actual.functions.toFixed(2)}% (threshold ${t.functions_min_pct}%)`);
  console.log(`  statements: ${actual.statements.toFixed(2)}% (threshold ${t.statements_min_pct}%)`);
  const errors: string[] = [];
  if (actual.lines < t.lines_min_pct) errors.push(`lines ${actual.lines}% < ${t.lines_min_pct}%`);
  if (actual.branches < t.branches_min_pct) errors.push(`branches ${actual.branches}% < ${t.branches_min_pct}%`);
  if (actual.functions < t.functions_min_pct) errors.push(`functions ${actual.functions}% < ${t.functions_min_pct}%`);
  if (actual.statements < t.statements_min_pct) errors.push(`statements ${actual.statements}% < ${t.statements_min_pct}%`);
  if (errors.length > 0) {
    for (const e of errors) console.error(`[ERROR] ${e}`);
    process.exit(1);
  }
  console.log('[check-coverage] OK');
}
main();
