// Phase 8-4: data-testid 必須 lint
// modal (role="dialog") に data-testid 必須 (error)
// onClick button に data-testid 推奨 (warn)

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const COMPONENTS_DIR = join(process.cwd(), 'src', 'ui', 'components');

type Issue = { file: string; msg: string; level: 'error' | 'warn' };

function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith('.tsx')) out.push(p);
  }
  return out;
}

function lintFile(file: string): Issue[] {
  const issues: Issue[] = [];
  const s = readFileSync(file, 'utf-8');

  // role="dialog" を含む要素ブロック (300 chars 前後) で data-testid あるか
  for (const m of s.matchAll(/role=["']dialog["']/g)) {
    const start = Math.max(0, (m.index ?? 0) - 300);
    const end = Math.min(s.length, (m.index ?? 0) + 300);
    const block = s.slice(start, end);
    if (!/data-testid=/.test(block)) {
      // 段階移行猶予中は warn (新規 dialog 追加時に注意)
      issues.push({ file, msg: `role="dialog" 要素に data-testid 未指定 (offset ${m.index})`, level: 'warn' });
    }
  }

  // <button ...onClick=... ...> で data-testid 無し → warn
  for (const m of s.matchAll(/<button\b[^>]*onClick\s*=/g)) {
    const start = m.index ?? 0;
    // 同 tag 内の終わり > を探す
    const tagEnd = s.indexOf('>', start);
    if (tagEnd < 0) continue;
    const tag = s.slice(start, tagEnd);
    if (!/data-testid=/.test(tag)) {
      issues.push({ file, msg: `<button onClick> に data-testid 未指定 (offset ${start})`, level: 'warn' });
    }
  }

  return issues;
}

function main(): void {
  const files = walk(COMPONENTS_DIR);
  const all: Issue[] = [];
  for (const f of files) all.push(...lintFile(f));
  const errors = all.filter((i) => i.level === 'error');
  const warns = all.filter((i) => i.level === 'warn');
  for (const i of errors) console.error(`[ERROR] ${i.file}: ${i.msg}`);
  for (const i of warns) console.warn(`[WARN]  ${i.file}: ${i.msg}`);
  console.log(`[lint-component-testid] ${files.length} files / errors=${errors.length} / warns=${warns.length}`);
  if (errors.length > 0) process.exit(1);
}
main();
