import { test, expect, type Locator, type Page } from '@playwright/test';
import { setupGamePage } from './helpers/setup.js';

type GameWindow = {
  __game: {
    createSampleGameState: () => unknown;
  };
};

async function expectFullyInsideViewport(page: Page, locator: Locator): Promise<void> {
  const bounds = await locator.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return {
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      left: rect.left,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
    };
  });

  expect(bounds.left).toBeGreaterThanOrEqual(0);
  expect(bounds.top).toBeGreaterThanOrEqual(0);
  expect(bounds.right).toBeLessThanOrEqual(bounds.viewportWidth);
  expect(bounds.bottom).toBeLessThanOrEqual(bounds.viewportHeight);
}

test.describe('mobile viewport controls', () => {
  test('short landscapeでもマリガン確定操作へ到達できる', async ({ page }) => {
    await page.setViewportSize({ width: 740, height: 360 });
    const { errors } = await setupGamePage(page);

    await page.locator('[data-testid="game-setup-start"]').click();
    const skip = page.locator('.mulligan-modal button:has-text("引き直しなし")');
    await expect(skip).toBeVisible();
    await skip.scrollIntoViewIfNeeded();
    await expectFullyInsideViewport(page, skip);
    await skip.click();

    await expect(page.locator('.mulligan-modal')).not.toBeVisible();
    expect(errors).toEqual([]);
  });

  test('landscapeでリプレイ終了操作がviewport内に収まる', async ({ page }) => {
    await page.setViewportSize({ width: 851, height: 393 });
    const { errors } = await setupGamePage(page);

    await page.evaluate(() => {
      const w = window as unknown as GameWindow;
      const log = {
        schemaVersion: 1,
        initialState: w.__game.createSampleGameState(),
        moves: [
          { turn: 1, player: 'self', move: { kind: 'endTurn' } },
          { turn: 1, player: 'opp', move: { kind: 'endTurn' } },
        ],
        result: { winner: 'self', reason: 'turn-cap', turns: 1 },
      };
      const input = document.querySelector(
        '[data-testid="game-setup-replay-file"]',
      ) as HTMLInputElement | null;
      if (!input) throw new Error('replay file input not found');
      const transfer = new DataTransfer();
      transfer.items.add(new File([JSON.stringify(log)], 'test-replay.json', {
        type: 'application/json',
      }));
      input.files = transfer.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });

    const close = page.locator('[data-testid="replay-close"]');
    await expect(close).toBeVisible();
    await expectFullyInsideViewport(page, close);
    await close.click();

    await expect(page.locator('[data-testid="replay-panel"]')).not.toBeVisible();
    expect(errors).toEqual([]);
  });
});
