// Phase 7-C (LESSONS-LEARNED 教訓 3 enforcement):
// 新規カード追加時の自動 checklist
//
// git diff base..HEAD で src/cards/ct-d??/D?????.ts の新規追加を検出し、
// 同 commit / 同 PR に下記いずれかが含まれるかを check:
//   - tests/cards/.../D?????.test.ts (unit test 同梱)
//   - tests/e2e/patterns/*.spec.ts への参照追加
//   - commit message に "card-addition-checklist 完了" の明示
//
// 不足時は warn (block しない)。pre-commit hook 統合。

import { execSync } from 'node:child_process';

function git(args: string): string {
  try {
    return execSync(`git ${args}`, { encoding: 'utf-8' });
  } catch {
    return '';
  }
}

function stagedFiles(): string[] {
  const out = git('diff --name-only --cached');
  return out.split('\n').filter(Boolean);
}

function recentCommitMessage(): string {
  return git('log -1 --pretty=%B').trim();
}

const CARD_PATTERN = /^src\/cards\/ct-d\d{2}\/D\d{5}\.ts$/;
const TEST_PATTERN = /^tests\/cards\/.*D\d{5}\.test\.ts$/;
const E2E_PATTERN = /^tests\/e2e\/patterns\/.+\.spec\.ts$/;

function main(): void {
  const files = stagedFiles();
  const addedCards = files.filter((f) => CARD_PATTERN.test(f));

  if (addedCards.length === 0) {
    console.log('[lint-card-addition] no new card files in staged diff');
    return;
  }

  const hasTest = files.some((f) => TEST_PATTERN.test(f));
  const hasE2E = files.some((f) => E2E_PATTERN.test(f));
  const msg = recentCommitMessage();
  const hasChecklist = msg.includes('card-addition-checklist') || msg.includes('checklist 完了');

  for (const card of addedCards) {
    const m = card.match(/D(\d{5})\.ts$/);
    const cardId = m ? `D${m[1]}` : card;
    if (!hasTest && !hasE2E && !hasChecklist) {
      console.warn(`[WARN] ${cardId}: card-addition-checklist が未確認 — unit test / E2E spec / commit message のいずれも紐づけなし。.claude/specs/card-addition-checklist.md を参照。`);
    } else {
      console.log(`[OK]   ${cardId}: ${hasTest ? 'unit-test' : hasE2E ? 'e2e-spec' : 'checklist-msg'} に紐づけ確認`);
    }
  }

  console.log(`[lint-card-addition] checked ${addedCards.length} new card files`);
  // warn only — never exit 1
}

main();
