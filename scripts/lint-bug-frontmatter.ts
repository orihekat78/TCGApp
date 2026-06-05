// Phase 4-E (BUG-template + lint): BUG-XXX.md frontmatter lint
//
// allowed values を check し、status=修正済 で commit=TBD/欠落 を fail させる。
// CI / pre-commit hook で実行され、frontmatter の品質を強制する。
//
// 使い方: npm run lint:bugs

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const BUGS_DIR = join(process.cwd(), '.claude', 'bugs');

const ALLOWED_STATUS = new Set(['未着手', '対応中', '修正済', '見送り', '仕様外']);
const ALLOWED_SEVERITY = new Set(['重大', '高', '中', '低', '軽微']);
const ALLOWED_CATEGORY = new Set([
  'engine',
  'engine-listener',
  'ui-feature',
  'ui-text',
  'ui-ux',
  'ai',
  'meta',
  'infrastructure',
]);
// Phase 7-B: 再発パターンクラスタ enum (LESSONS-LEARNED 5 cluster + none)
const ALLOWED_CLUSTER = new Set([
  'side-channel',
  'listener',
  'ui-text',
  'modal-stack',
  'binding-ref',
  'none',
]);

type Issue = { file: string; level: 'error' | 'warn'; msg: string };

function parseFrontmatter(content: string): Record<string, string> | null {
  // 2026-05-30: CRLF (\r\n) 改行のファイルにも対応 (.claude/bugs/ は大半が CRLF)。
  // 旧 /^---\n/ は CRLF だと "---\r\n" にマッチせず frontmatter 未検出になっていた。
  const m = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return null;
  const fm: Record<string, string> = {};
  for (const line of m[1].split(/\r?\n/)) {
    const i = line.indexOf(':');
    if (i < 0) continue;
    fm[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return fm;
}

function lintBug(file: string, content: string): Issue[] {
  const issues: Issue[] = [];
  const fm = parseFrontmatter(content);
  if (!fm) {
    issues.push({ file, level: 'error', msg: 'frontmatter (--- ... ---) なし' });
    return issues;
  }

  // 必須 field
  for (const k of ['id', 'title', 'severity', 'category', 'status', 'date_found', 'reporter']) {
    if (!fm[k]) issues.push({ file, level: 'error', msg: `frontmatter "${k}" 欠落` });
  }

  // enum check — 2026-06-05: 完全一致ではなく **prefix match** に緩和。
  // 既存の「修正済 (D08024/D11020) / 一部継続 (D11014 bind)」「未着手 (DEFERRED — …)」のような
  // richer な suffix 表記を許容しつつ、先頭 token は enum 値のいずれかであることを保証する。
  if (fm.status) {
    const prefixOk = [...ALLOWED_STATUS].some((v) => fm.status === v || fm.status.startsWith(`${v} `) || fm.status.startsWith(`${v}(`));
    if (!prefixOk) {
      issues.push({ file, level: 'error', msg: `status "${fm.status}" の先頭 token が enum 外 (allowed: ${[...ALLOWED_STATUS].join(' / ')})` });
    }
  }
  if (fm.severity && !ALLOWED_SEVERITY.has(fm.severity)) {
    issues.push({ file, level: 'error', msg: `severity "${fm.severity}" は enum 外 (allowed: ${[...ALLOWED_SEVERITY].join(' / ')})` });
  }
  if (fm.category && !ALLOWED_CATEGORY.has(fm.category)) {
    issues.push({ file, level: 'warn', msg: `category "${fm.category}" は推奨 enum 外 (warn のみ、移行猶予中)` });
  }
  // Phase 7-B: recurrence_cluster は optional だが、指定されていれば enum check
  if (fm.recurrence_cluster && !ALLOWED_CLUSTER.has(fm.recurrence_cluster)) {
    issues.push({ file, level: 'warn', msg: `recurrence_cluster "${fm.recurrence_cluster}" は enum 外 (allowed: ${[...ALLOWED_CLUSTER].join(' / ')})` });
  }

  // status=修正済 (prefix match) → commit + date_fixed 必須
  // suffix 表記「修正済 (xxxxx) / 一部継続 (yyyyy)」等にも対応 (2026-06-05 lint 緩和)
  const isFixed = typeof fm.status === 'string' && (fm.status === '修正済' || fm.status.startsWith('修正済 ') || fm.status.startsWith('修正済('));
  if (isFixed) {
    if (!fm.commit || fm.commit === 'TBD' || fm.commit === '') {
      issues.push({ file, level: 'error', msg: `status=修正済 (prefix) だが commit が "${fm.commit ?? '(empty)'}" — git hash を反映してください` });
    }
    if (!fm.date_fixed) {
      issues.push({ file, level: 'error', msg: 'status=修正済 (prefix) だが date_fixed 欠落' });
    }
  }

  return issues;
}

function main(): void {
  const files = readdirSync(BUGS_DIR)
    .filter((f) => /^BUG-\d{3}\.md$/.test(f))
    .filter((f) => f !== 'BUG-template.md')
    .sort();

  if (files.length === 0) {
    console.log('[lint-bugs] no BUG-*.md files');
    return;
  }

  const allIssues: Issue[] = [];
  for (const f of files) {
    const content = readFileSync(join(BUGS_DIR, f), 'utf-8');
    allIssues.push(...lintBug(f, content));
  }

  const errors = allIssues.filter((i) => i.level === 'error');
  const warns = allIssues.filter((i) => i.level === 'warn');

  for (const i of errors) console.error(`[ERROR] ${i.file}: ${i.msg}`);
  for (const i of warns) console.warn(`[WARN]  ${i.file}: ${i.msg}`);

  console.log(`[lint-bugs] ${files.length} BUG files / errors=${errors.length} / warns=${warns.length}`);

  if (errors.length > 0) {
    process.exit(1);
  }
}

main();
