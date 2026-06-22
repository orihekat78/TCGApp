import { test, expect } from '@playwright/test';
import { setupGamePage } from './helpers/setup.js';

// user_request 20260521_01 #12: 観戦モード speed slider + pause/step E2E
//
// 検証内容:
//   1. 観戦モードで SpectatorHUD が表示される (slider + pause + step ボタン)
//   2. 速度 preset 切替で store.aiSpeedMs / DOM が反映
//   3. pause で AI が止まる (turn 数が進まない)
//   4. step button で AI が 1 手ずつ進む (design: per-move / 1ステップ。turn が進むまで繰り返せる)
//   5. resume で連続進行に復帰

type GameWindow = {
  __game: {
    getState: () => {
      gameState: { turn: { number: number; player: 'self' | 'opp' }; gameResult?: unknown; log: unknown[] } | null;
      activeActionId: string | null;
      spectatorMode: boolean;
      aiSpeedMs: number;
      isAiPaused: boolean;
      aiStepCounter: number;
      setAiPaused: (v: boolean) => void;
      setAiSpeedMs: (ms: number) => void;
    };
  };
};

test.describe('user_request #12: SpectatorHUD speed + pause/step', () => {
  test('SpectatorHUD が観戦モード起動後に表示される (slider + pause + step)', async ({ page }) => {
    const { errors } = await setupGamePage(page);
    // Pre-pause to avoid game running before assertions
    await page.evaluate(() => {
      (window as unknown as GameWindow).__game.getState().setAiPaused(true);
    });
    await page.locator('[data-testid="game-setup-spectate"]').click();
    await page.waitForSelector('.mulligan-modal', { timeout: 5000 });
    await page.locator('.mulligan-modal button:has-text("引き直しなし")').click();

    // SpectatorHUD 表示確認
    await expect(page.locator('[data-testid="spectator-hud"]')).toBeVisible({ timeout: 3000 });
    // slider 5 preset
    for (const ms of [200, 400, 800, 1500, 3000]) {
      await expect(page.locator(`[data-testid="spectator-speed-${ms}"]`)).toBeVisible();
    }
    // pause toggle + step button
    await expect(page.locator('[data-testid="spectator-pause-toggle"]')).toBeVisible();
    await expect(page.locator('[data-testid="spectator-step"]')).toBeVisible();
    // step button は paused 中なので enabled
    await expect(page.locator('[data-testid="spectator-step"]')).toBeEnabled();

    expect(errors, `console errors: ${errors.join(' | ')}`).toEqual([]);
  });

  test('speed preset クリックで store.aiSpeedMs と DOM 表示が反映', async ({ page }) => {
    const { errors } = await setupGamePage(page);
    await page.evaluate(() => {
      (window as unknown as GameWindow).__game.getState().setAiPaused(true);
    });
    await page.locator('[data-testid="game-setup-spectate"]').click();
    await page.waitForSelector('.mulligan-modal', { timeout: 5000 });
    await page.locator('.mulligan-modal button:has-text("引き直しなし")').click();

    await expect(page.locator('[data-testid="spectator-hud"]')).toBeVisible({ timeout: 3000 });
    // 1500ms クリック
    await page.locator('[data-testid="spectator-speed-1500"]').click();
    const v1 = await page.evaluate(() => (window as unknown as GameWindow).__game.getState().aiSpeedMs);
    expect(v1).toBe(1500);
    await expect(page.locator('[data-testid="spectator-speed-current"]')).toHaveText('1500ms');
    await expect(page.locator('[data-testid="spectator-speed-1500"]')).toHaveAttribute('aria-pressed', 'true');

    // 200ms に切替
    await page.locator('[data-testid="spectator-speed-200"]').click();
    const v2 = await page.evaluate(() => (window as unknown as GameWindow).__game.getState().aiSpeedMs);
    expect(v2).toBe(200);
    await expect(page.locator('[data-testid="spectator-speed-current"]')).toHaveText('200ms');

    expect(errors, `console errors: ${errors.join(' | ')}`).toEqual([]);
  });

  test('pause → step → resume の連携 (turn が止まる / step で進む / resume で連続)', async ({ page }) => {
    const { errors } = await setupGamePage(page);
    // Pre-pause
    await page.evaluate(() => {
      (window as unknown as GameWindow).__game.getState().setAiPaused(true);
    });
    await page.locator('[data-testid="game-setup-spectate"]').click();
    await page.waitForSelector('.mulligan-modal', { timeout: 5000 });
    await page.locator('.mulligan-modal button:has-text("引き直しなし")').click();

    await expect(page.locator('[data-testid="spectator-hud"]')).toBeVisible({ timeout: 3000 });
    // paused 直後の turn
    const turn1 = await page.evaluate(() => (window as unknown as GameWindow).__game.getState().gameState!.turn.number);
    // 1 秒待っても進まないこと (paused)
    await page.waitForTimeout(1000);
    const turn2 = await page.evaluate(() => (window as unknown as GameWindow).__game.getState().gameState!.turn.number);
    expect(turn2, '1 秒待っても paused なので turn 不変').toBe(turn1);

    // step button は design 上 per-move (= 1 手) 進行 (aiStepCounter は per-move / 1ステップ)。
    // 先攻が self なら self driver が playTurn で 1 ターンを丸ごと進めるため 1 step で turn が
    // 進むが、先攻が opp の場合 opp driver は stepTurn で 1 手ずつ進むため 1 step では turn 番号が
    // 進まない。旧版は単一 step + fixed wait で「turn が進む」を期待しており、先攻の coin flip
    // (約 50%) で flake していた。よって step ごとに 1 手前進することを確認しつつ、turn が進むまで
    // 繰り返す形に変更する (先攻に依らず決定的)。
    // 各 step を確実に消費させるため speed を最速 (0=即時 microtask) にし、連打による
    // aiStepCounter collapse を避けて 1 手ずつ進行を待つ。
    await page.evaluate(() => (window as unknown as GameWindow).__game.getState().setAiSpeedMs(0));
    let turn3 = turn2;
    let progressed = false;
    for (let clicks = 0; clicks < 30 && turn3 <= turn2; clicks++) {
      const before = await page.evaluate(() => {
        const gs = (window as unknown as GameWindow).__game.getState().gameState!;
        return { len: gs.log.length, turn: gs.turn.number };
      });
      await page.locator('[data-testid="spectator-step"]').click();
      // この step が driver に消費される (log 追記 or turn 進行 = 1 手前進) のを待ってから次を押す
      const moved = await page
        .waitForFunction(
          (b) => {
            const gs = (window as unknown as GameWindow).__game.getState().gameState;
            return !!gs && (gs.log.length > b.len || gs.turn.number > b.turn);
          },
          before,
          { timeout: 5_000 },
        )
        .then(() => true)
        .catch(() => false);
      if (moved) progressed = true;
      turn3 = await page.evaluate(() => (window as unknown as GameWindow).__game.getState().gameState!.turn.number);
    }
    expect(progressed, 'step で AI が 1 手以上前進する').toBe(true);
    expect(turn3, 'step を繰り返すと turn が進む').toBeGreaterThan(turn2);

    // resume (pause toggle) → 連続進行
    await page.locator('[data-testid="spectator-pause-toggle"]').click();
    await page.waitForFunction(
      (start) => {
        const w = window as unknown as GameWindow;
        const s = w.__game.getState().gameState;
        if (!s) return false;
        // gameResult set or turn が大きく進んだら通過
        return !!s.gameResult || s.turn.number > start + 3;
      },
      turn3,
      { timeout: 30_000 },
    );

    expect(errors, `console errors: ${errors.join(' | ')}`).toEqual([]);
  });
});
