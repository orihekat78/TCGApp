// Phase 8-2: 新規 .ts file → test pair 必須 lint
// git diff staged で新規 src/ ファイルに対応 tests/ が無ければ warn

import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

function git(cmd: string): string {
  try { return execSync(`git ${cmd}`, { encoding: 'utf-8' }); } catch { return ''; }
}

function stagedAdded(): string[] {
  return git('diff --name-only --cached --diff-filter=A')
    .split('\n').filter(Boolean);
}

// src/ source file (NOT test/index/types)
function isSourceFile(p: string): boolean {
  if (!/^src\/(engine|ui|ai|cards)\//.test(p)) return false;
  if (!/\.(ts|tsx)$/.test(p)) return false;
  if (/\.test\.(ts|tsx)$/.test(p)) return false;
  if (/\/index\.ts$/.test(p)) return false;
  if (/\/types\//.test(p)) return false;
  if (/\/sampleGameState\.ts$/.test(p)) return false;
  return true;
}

function expectedTestPath(src: string): string {
  // src/foo/bar.ts → tests/foo/bar.test.ts (or .tsx)
  return src.replace(/^src\//, 'tests/').replace(/\.(ts|tsx)$/, '.test.$1');
}

function main(): void {
  const added = stagedAdded().filter(isSourceFile);
  if (added.length === 0) {
    console.log('[lint-test-pair] no new source files in staged diff');
    return;
  }

  let warns = 0;
  for (const src of added) {
    const expected = expectedTestPath(src);
    const exists = existsSync(join(process.cwd(), expected));
    // 同 commit に test file も含まれているか
    const inStaged = stagedAdded().includes(expected);
    if (exists || inStaged) {
      console.log(`[OK]   ${src} → ${expected}`);
    } else {
      console.warn(`[WARN] ${src}: 対応 test ${expected} が見つからない (新規追加時は test pair 推奨)`);
      warns++;
    }
  }
  console.log(`[lint-test-pair] ${added.length} new source files / warns=${warns}`);
  // warn のみ、block しない
}
main();
