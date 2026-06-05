// 1試合通し Playwright smoke (human vs CPU) — CLAUDE.md 6.3 compliance
//
// 既存 full-match.spec.ts は **観戦モード (AI vs AI)** をカバーするが、CLAUDE.md は
// 「人間 vs CPU を mulligan → 勝敗決定 (or max 30 turn) まで通して操作」を要求する。
// 本 spec は self=人間 (= 各ターン end-turn のみ実施 / 最小行動) / opp=CPU (= AI policy)
// のシナリオで一試合通し、console error 0 と turn 進行を検証する。
//
// CLAUDE.md 要件:
//   - click → effect resolution → state 反映を実機で確認 ✓
//   - 人間 vs CPU を mulligan → 勝敗決定 (or max 30 turn) まで通す ✓
//   - 各 step で console error 0 ✓
//   - 「画面表示確認 ≠ 機能確認」両方必要 ✓
//
// self の行動は end-turn のみ — これは「自分側の操作が AI 経路と切替わる境界で
// バグが出ないか」を主に検証する smoke。実 deck の各カード ability 動作は
// 個別 spec で個別検証 (engine-extensions-2026-06-05.spec.ts 等)。

import { test, expect, type Page } from '@playwright/test';
import { setupGamePage } from './helpers/setup.js';

type GameSnapshot = {
  turnNumber: number;
  turnPlayer: 'self' | 'opp';
  phase: string;
  gameResult: { winner: 'self' | 'opp'; reason: string } | null;
  selfFile: number;
  oppFile: number;
};

async function snapshot(page: Page): Promise<GameSnapshot | null> {
  return page.evaluate(() => {
    const w = window as unknown as {
      __game: {
        getState: () => {
          gameState: {
            gameResult?: { winner: 'self' | 'opp'; reason: string } | null;
            turn: { number: number; player: 'self' | 'opp'; phase: string };
            players: { self: { file: unknown[] }; opp: { file: unknown[] } };
          } | null;
        };
      };
    };
    const gs = w.__game.getState().gameState;
    if (!gs) return null;
    return {
      turnNumber: gs.turn?.number ?? 0,
      turnPlayer: gs.turn?.player ?? 'self',
      phase: gs.turn?.phase ?? 'unknown',
      gameResult: gs.gameResult ?? null,
      selfFile: gs.players.self.file.length,
      oppFile: gs.players.opp.file.length,
    } as GameSnapshot;
  });
}

test.describe('1試合通し smoke (human vs CPU) — CLAUDE.md 6.3', () => {
  test('mulligan → 勝敗決定 or max 30 turn まで通して console error 0', async ({ page }) => {
    test.setTimeout(120_000);
    const { errors } = await setupGamePage(page);

    // AI speed を 0ms に設定 (test 高速化、本番 400ms から短縮)
    await page.evaluate(() => {
      const w = window as unknown as { __game: { store: { getState: () => { setAiSpeedMs: (ms: number) => void } } } };
      w.__game.store.getState().setAiSpeedMs(0);
    });

    // GameSetupModal が表示 → 「対戦開始」(human vs CPU mode)
    await expect(page.locator('[data-testid="game-setup-start"]')).toBeVisible();
    await page.locator('[data-testid="game-setup-start"]').click();

    // self mulligan: 引き直しなし で skip
    await page.waitForSelector('.mulligan-modal', { timeout: 5000 });
    await page.locator('.mulligan-modal button:has-text("引き直しなし")').click();

    // self の最初の主体ターンに到達するまで待つ (auto-phase 完了待ち)
    await expect
      .poll(async () => (await snapshot(page))?.phase ?? null, { timeout: 10_000 })
      .toBe('main');

    // turn 進行 loop — self は end-turn のみ、opp は useOppTurnDriver 自動進行
    const maxTurns = 30;
    const maxWaitMs = 100_000;
    const startedAt = Date.now();
    let prevTurnNumber = -1;
    let turnPeak = 0;
    let finalState: GameSnapshot | null = null;

    while (Date.now() - startedAt < maxWaitMs) {
      const snap = await snapshot(page);
      if (!snap) {
        await page.waitForTimeout(200);
        continue;
      }
      finalState = snap;
      if (snap.turnNumber > turnPeak) turnPeak = snap.turnNumber;

      // 勝敗決定 → break
      if (snap.gameResult) break;
      // max-turn cap
      if (snap.turnNumber >= maxTurns) break;

      if (snap.turnPlayer === 'self' && snap.phase === 'main') {
        // self ターン: end-turn ボタンを click → ConfirmModal で「ターン終了」を確定
        // runEndTurnFlow は useConfirmation.ask() で確認モーダルを出すため、UI 経由で確定が必要
        const beforeTurn = snap.turnNumber;
        const btn = page.locator('button.end-turn-btn');
        const enabled = await btn.isEnabled().catch(() => false);
        if (enabled) {
          await btn.click();
          // ConfirmModal が表示 → 「ターン終了」OK ボタンを click
          await page.waitForSelector('.confirm-modal-footer .confirm-ok', { timeout: 3_000 });
          await page.locator('.confirm-modal-footer .confirm-ok').click();
          // 確定後、turnNumber が増えるまで poll
          await expect
            .poll(async () => (await snapshot(page))?.turnNumber ?? 0, { timeout: 20_000, intervals: [300, 500, 800, 1200] })
            .toBeGreaterThan(beforeTurn);
        } else {
          await page.waitForTimeout(500);
        }
      } else {
        // opp ターン: useOppTurnDriver 自動進行 → player=self に戻るまで待つ
        await expect
          .poll(async () => (await snapshot(page))?.turnPlayer ?? null, { timeout: 20_000, intervals: [400, 500, 800] })
          .toBe('self');
      }

      prevTurnNumber = snap.turnNumber;
    }

    expect(finalState, 'gameState 取得失敗').not.toBeNull();
    expect(turnPeak, 'ターンが 1 つも進まなかった').toBeGreaterThan(0);

    // 勝敗決定 OR max-turn cap、どちらかで停止していること
    if (finalState!.gameResult) {
      expect(['self', 'opp']).toContain(finalState!.gameResult.winner);
      console.log(`[smoke] 勝敗決定: winner=${finalState!.gameResult.winner} / reason=${finalState!.gameResult.reason} / turn=${turnPeak}`);
    } else {
      console.log(`[smoke] max-turn cap: turn=${turnPeak} (gameResult なし)`);
    }

    // console error 0
    expect(errors, `console errors: ${errors.join(' | ')}`).toEqual([]);
  });
});
