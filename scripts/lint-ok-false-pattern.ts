// Phase 8-5: ok:false caller heuristic check
// 教訓 8: ok:false 戻り値を受けた caller が単純 break/return のみだと
// gameResult set 忘れの可能性あり → warn

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SRC_DIR = join(process.cwd(), 'src');

function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith('.ts') && !p.endsWith('.test.ts')) out.push(p);
  }
  return out;
}

type Issue = { file: string; msg: string; level: 'warn' };

function lintFile(file: string): Issue[] {
  const issues: Issue[] = [];
  const s = readFileSync(file, 'utf-8');
  // pattern: `if (!result.ok) {`  続いて 100 chars 内が `break;` か単純 `return`
  // のみ (空行除く 1 行) なら警告。state.gameResult 等の set があれば OK。
  const pattern = /if\s*\(\s*!\s*\w+\.ok\s*\)\s*\{([^}]{0,200})\}/g;
  for (const m of s.matchAll(pattern)) {
    const body = m[1];
    // gameResult set / throw / function call (chain) を含めば OK
    if (/gameResult\.|throw |\.set\(|emit\(|push\(|return\s+\w/.test(body)) continue;
    // body が単純 break / return のみ (or コメントのみ) なら警告
    const lines = body.split('\n').map((l) => l.replace(/\/\/.*/, '').trim()).filter(Boolean);
    if (lines.length === 0) continue;
    if (lines.every((l) => /^(break|return|continue);?$/.test(l))) {
      issues.push({ file, msg: `if (!*.ok) の body が break/return のみ — gameResult set 漏れの恐れ (教訓 8、BUG-036 pattern)`, level: 'warn' });
    }
  }
  return issues;
}

function main(): void {
  const files = walk(SRC_DIR);
  const all: Issue[] = [];
  for (const f of files) all.push(...lintFile(f));
  for (const i of all) console.warn(`[WARN]  ${i.file}: ${i.msg}`);
  console.log(`[lint-ok-false-pattern] ${files.length} files / warns=${all.length}`);
  // warn のみ、block しない
}
main();
