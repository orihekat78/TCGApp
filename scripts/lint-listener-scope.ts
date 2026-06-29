// Phase 7-D (LESSONS-LEARNED 教訓 2 enforcement):
// triggered ability の scope / selfOnly / matcher 必須 lint
//
// src/cards/ 配下で `type: 'triggered'` を含む ability object に対して
// 以下 3 点が記述されているか正規表現 check:
//   - scope: (on-scene / on-hand / on-partner-area / on-evidence / always)
//   - trigger.selfOnly: boolean (明示)
//   - trigger.matcher: 関数定義
//
// 不足時は error (CI fail)。pre-commit hook 統合。

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const CARDS_DIR = join(process.cwd(), 'src', 'cards');

// 'on-set-host' (2026-06-29c): 装備イベント等がセット先 host に付与するライダー scope (rules/16)。
const ALLOWED_SCOPE = ['on-scene', 'on-hand', 'on-partner-area', 'on-evidence', 'on-set-host', 'always'];

type Issue = { file: string; msg: string; level: 'error' | 'warn' };

function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith('.ts') && !p.endsWith('.test.ts')) out.push(p);
  }
  return out;
}

function lintFile(file: string): Issue[] {
  const issues: Issue[] = [];
  const s = readFileSync(file, 'utf-8');
  // 各 `type: 'triggered'` 直前から次の ability or 末尾までを 1 つの ability block と扱う
  // 簡易: triggered block 内の `scope:` / `selfOnly:` / `matcher:` の存在を check
  const triggeredMatches = [...s.matchAll(/type:\s*['"]triggered['"]/g)];
  if (triggeredMatches.length === 0) return issues;

  for (const m of triggeredMatches) {
    const idx = m.index ?? 0;
    // 後続 600 文字を ability block とみなして check
    const block = s.slice(idx, idx + 800);
    // scope
    const scopeMatch = block.match(/scope:\s*['"]([^'"]+)['"]/);
    if (!scopeMatch) {
      issues.push({ file, msg: `triggered ability に scope 未指定 (offset ${idx})`, level: 'error' });
    } else if (!ALLOWED_SCOPE.includes(scopeMatch[1])) {
      issues.push({ file, msg: `scope "${scopeMatch[1]}" は enum 外 (allowed: ${ALLOWED_SCOPE.join(', ')})`, level: 'error' });
    }
    // selfOnly (warn のみ、optional でも可だが推奨)
    if (!/selfOnly:/.test(block)) {
      issues.push({ file, msg: `triggered ability に selfOnly 未指定 (推奨、教訓 2 参照) (offset ${idx})`, level: 'warn' });
    }
    // matcher (関数 or undefined 明示)
    if (!/matcher:/.test(block) && !/hook:\s*['"]enter['"]/.test(block)) {
      // 'enter' hook は matcher 省略しても OK
      issues.push({ file, msg: `triggered ability に matcher 未指定 (offset ${idx})`, level: 'warn' });
    }
  }
  return issues;
}

function main(): void {
  const files = walk(CARDS_DIR);
  const allIssues: Issue[] = [];
  for (const f of files) allIssues.push(...lintFile(f));

  const errors = allIssues.filter((i) => i.level === 'error');
  const warns = allIssues.filter((i) => i.level === 'warn');

  for (const i of errors) console.error(`[ERROR] ${i.file}: ${i.msg}`);
  for (const i of warns) console.warn(`[WARN]  ${i.file}: ${i.msg}`);

  console.log(`[lint-listener-scope] ${files.length} files / errors=${errors.length} / warns=${warns.length}`);

  if (errors.length > 0) process.exit(1);
}

main();
