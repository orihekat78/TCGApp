import { test, expect } from '@playwright/test';
import { setupGamePage } from './helpers/setup.js';

// user_request 20260521_01 #12: 観戦モード speed slider + pause/step E2E
//
// 検証内容:
//   1. 観戦モードで SpectatorHUD が表示される (slider + pause + step ボタン)
//   2. 速度 preset 切替で store.aiSpeedMs / DOM が反映
//   3. pause で AI が止まる (turn 数が進まない)
//   4. step button で 1 cycle (opp + self) 進む
//   5. resume で連続進行に復帰

type GameWindow = {
  __game: {
    getState: () => {
      gameState: { turn: { number: number; player: 'self' | 'opp' }; gameResult?: unknown } | null;
      activeActionId: string | null;
      spectatorMode: boolean;
      aiSpeedMs: number;
      isAiPaused: boolean;
      aiStepCounter: number;
      setAiPaused: (v: boolean) => void;
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

  test('pause → step → resume の連携 (turn が止まる / 1 step で進む / resume で連続)', async ({ page }) => {
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

    // step を 1 回押す → turn が進む (両 driver が consume するので opp+self 1 cycle)
    await page.locator('[data-testid="spectator-step"]').click();
    // step 反映に短い wait
    await page.waitForTimeout(500);
    const turn3 = await page.evaluate(() => (window as unknown as GameWindow).__game.getState().gameState!.turn.number);
    expect(turn3, 'step 後は turn が進む').toBeGreaterThan(turn2);

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
