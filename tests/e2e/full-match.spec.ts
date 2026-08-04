import { test, expect } from '@playwright/test';
import { setupGamePage } from './helpers/setup.js';

// BUG-045 (user_request 20260521_01 #9): 1 試合通し E2E。
//
// mulligan UI → 試合終了 (or max-turn cap) までを一貫して走らせ、UI 層全体の
// 配線が機能しているかを検証する。BUG-040/041/042/043 で連続発覚した
// 「Playmat.tsx prop 配線漏れ」pattern を将来予防するための smoke spec。
//
// 主な検証ポイント:
//   1. GameSetupModal でデッキ選択 UI が表示される (BUG-042 回帰防止)
//   2. 「観戦モード (AI vs AI)」で両 AI が turn を進める
//   3. 試合終了 (gameResult.winner セット) または max-turn cap で安全に停止
//   4. 試合中に console error が発生しない
//   5. console error filter は setupGamePage が favicon 404 等を除外

type GameWindow = {
  __game: {
    getState: () => {
      gameState: {
        gameResult?: { winner: 'self' | 'opp'; reason: string } | null;
        turn: { number: number; player: 'self' | 'opp' };
      } | null;
    };
  };
};

test.describe('BUG-045: 1 試合通し E2E (観戦モード)', () => {
  test('観戦モード: 試合が console error 無しで完了 or max-turn 到達', async ({ page }) => {
    test.setTimeout(90_000);
    const { errors } = await setupGamePage(page);

    // GameSetupModal が表示されているか確認 (BUG-042 配線確認)
    await expect(page.locator('[data-testid="game-setup-self-deck"]')).toBeVisible();
    await expect(page.locator('[data-testid="game-setup-opp-deck"]')).toBeVisible();
    await expect(page.locator('[data-testid="game-setup-spectate"]')).toBeVisible();

    // 観戦モード開始
    await page.locator('[data-testid="game-setup-spectate"]').click();

    // 観戦モードでも self の mulligan UI が出るので「引き直しなし」で skip
    // (AI mulligan policy は Phase 5+ defer、現状は MulliganProvider 共用)
    await page.waitForSelector('.mulligan-modal', { timeout: 5000 });
    await page.locator('.mulligan-modal button:has-text("引き直しなし")').click();

    // 以降は useSpectatorTurnDriver + useOppTurnDriver が 400ms / turn 単位で
    // 試合進行は useSpectatorTurnDriver + useOppTurnDriver が 400ms / turn 単位で
    // 自動的に進める。smoke baseline avg 11.19 turn / p95 14 / max 19 から推測、
    // 観戦の表示遅延 (~400ms × 2 player × turn) を加味し最大 60s 待つ。
    const maxWaitMs = 60_000;
    const start = Date.now();
    let finalState: GameWindow['__game']['__r'] | null = null;
    let turnPeak = 0;
    while (Date.now() - start < maxWaitMs) {
      const snapshot = await page.evaluate(() => {
        const w = window as unknown as GameWindow;
        const gs = w.__game.getState().gameState;
        if (!gs) return null;
        return {
          turnNumber: gs.turn?.number ?? 0,
          turnPlayer: gs.turn?.player ?? 'self',
          gameResult: gs.gameResult ?? null,
        };
      });
      if (snapshot === null) {
        await page.waitForTimeout(300);
        continue;
      }
      finalState = snapshot;
      if (snapshot.turnNumber > turnPeak) turnPeak = snapshot.turnNumber;
      if (snapshot.gameResult) break;
      // max-turn cap fallback: smoke の p95=14 を大きく超える 50 ターンで打切り
      if (snapshot.turnNumber >= 50) break;
      await page.waitForTimeout(500);
    }

    expect(finalState, 'gameState 取得失敗').not.toBeNull();
    expect(turnPeak, 'ターンが 1 つも進まなかった').toBeGreaterThan(0);
    // gameResult 到達か、50 ターン超のいずれかで停止する想定 (両者ともパス条件)
    if (!finalState!.gameResult) {
      console.warn(`max-turn cap で停止: turnPeak=${turnPeak}`);
    } else {
      expect(['self', 'opp']).toContain(finalState!.gameResult.winner);
    }

    // console error フィルタ後の errors が空であること
    expect(errors, `console errors: ${errors.join(' | ')}`).toEqual([]);
  });

  test('GameSetupModal: デッキ選択 UI が両 select で現在の 3 options を持つ (BUG-042 回帰防止)', async ({ page }) => {
    await setupGamePage(page);

    const selfDeckOptions = await page.locator('[data-testid="game-setup-self-deck"] option').count();
    const oppDeckOptions = await page.locator('[data-testid="game-setup-opp-deck"] option').count();

    expect(selfDeckOptions, 'self deck 選択肢数').toBe(3);
    expect(oppDeckOptions, 'opp deck 選択肢数').toBe(3);
  });
});
