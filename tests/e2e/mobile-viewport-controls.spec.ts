import { test, expect, type Locator, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { setupGamePage } from './helpers/setup.js';

const captureDirectory = resolve(process.cwd(), '.claude/research/ui/runtime-captures/2026-08-04-final');

test.beforeAll(async () => {
  await mkdir(captureDirectory, { recursive: true });
});

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
  test('公開SETUPからデスクトップと同じプレイマットと操作を横画面へ等比縮小する', async ({ page }) => {
    await page.setViewportSize({ width: 851, height: 393 });
    const { errors } = await setupGamePage(page, '/#setup');

    await page.locator('[data-testid="game-setup-start"]').click();
    const skip = page.locator('button.mulligan-skip');
    await expect(skip).toBeVisible();
    await skip.click();
    await expect(skip).not.toBeVisible();

    for (const viewport of [
      { width: 851, height: 393 },
      { width: 720, height: 393 },
      { width: 667, height: 375 },
    ]) {
      await page.setViewportSize(viewport);
      const scaler = page.locator('#scaler');
      await expect(scaler).toHaveAttribute('data-playmat-layout', 'desktop');
      await expect(scaler).toHaveAttribute('data-playmat-fit', 'contained-landscape');
      await expect(page.locator('[data-testid="spectator-hud"]')).toBeHidden();
      await expect(page.locator('.mobile-match-status-rail')).toHaveCount(0);
      await expect(page.locator('.actions-panel--mobile-rail')).toHaveCount(0);
      await expect(page.locator('.board-content > .actions-panel')).toBeVisible();

      const geometry = await page.evaluate(() => {
        const query = <T extends Element>(selector: string): T => {
          const element = document.querySelector<T>(selector);
          if (!element) throw new Error(`missing element: ${selector}`);
          return element;
        };
        const rect = (selector: string) => {
          const bounds = query<HTMLElement>(selector).getBoundingClientRect();
          return {
            x: bounds.x,
            y: bounds.y,
            width: bounds.width,
            height: bounds.height,
          };
        };
        const root = query<HTMLElement>('#scaler');
        const board = query<HTMLElement>('.board-content');
        return {
          viewport: { width: innerWidth, height: innerHeight },
          layout: root.dataset.playmatLayout,
          fit: root.dataset.playmatFit,
          logicalWidth: Number(root.dataset.playmatLogicalWidth),
          logicalHeight: Number(root.dataset.playmatLogicalHeight),
          scale: Number(root.dataset.stageScale),
          board: rect('.board-content'),
          boardInert: board.hasAttribute('inert'),
          boardAriaHidden: board.getAttribute('aria-hidden'),
          boardPointerEvents: getComputedStyle(board).pointerEvents,
          horizontalOverflow: document.documentElement.scrollWidth - innerWidth,
        };
      });

      expect(geometry.layout).toBe('desktop');
      expect(geometry.fit).toBe('contained-landscape');
      expect(geometry.logicalWidth).toBe(1920);
      expect(geometry.logicalHeight).toBe(1080);
      expect(geometry.board.width / geometry.logicalWidth).toBeCloseTo(geometry.scale, 4);
      expect(geometry.board.height / geometry.logicalHeight).toBeCloseTo(geometry.scale, 4);
      expect(geometry.board.width / geometry.board.height).toBeCloseTo(16 / 9, 4);
      expect(geometry.board.x).toBeGreaterThanOrEqual(0);
      expect(geometry.board.y).toBeGreaterThanOrEqual(0);
      expect(geometry.board.x + geometry.board.width).toBeLessThanOrEqual(viewport.width);
      expect(geometry.board.y + geometry.board.height).toBeLessThanOrEqual(viewport.height);
      expect(geometry.boardInert).toBe(false);
      expect(geometry.boardAriaHidden).toBeNull();
      expect(geometry.boardPointerEvents).not.toBe('none');
      expect(geometry.horizontalOverflow).toBeLessThanOrEqual(0);

      if (viewport.width === 851) {
        expect(geometry.board.width).toBeCloseTo(698.6667, 1);
        expect(geometry.board.height).toBeCloseTo(393, 1);
        expect(geometry.board.x).toBeCloseTo(76.1667, 1);
        expect(geometry.board.y).toBeCloseTo(0, 1);
        expect(viewport.width - geometry.board.x - geometry.board.width).toBeCloseTo(76.1667, 1);
      } else if (viewport.width === 720) {
        expect(geometry.board.width).toBeCloseTo(698.6667, 1);
        expect(geometry.board.height).toBeCloseTo(393, 1);
        expect(geometry.board.x).toBeCloseTo(10.6667, 1);
        expect(geometry.board.y).toBeCloseTo(0, 1);
        expect(viewport.width - geometry.board.x - geometry.board.width).toBeCloseTo(10.6667, 1);
      } else {
        expect(geometry.scale).toBeCloseTo(375 / 1080, 4);
        expect(geometry.board.width).toBeCloseTo(666.6667, 1);
        expect(geometry.board.height).toBeCloseTo(375, 1);
        expect(geometry.board.x).toBeCloseTo(0.1667, 1);
        expect(geometry.board.y).toBeCloseTo(0, 1);
        expect(viewport.width - geometry.board.x - geometry.board.width).toBeCloseTo(0.1667, 1);
      }

      if (viewport.width === 851) {
        await page.screenshot({
          path: resolve(captureDirectory, 'match-851x393.png'),
          fullPage: false,
        });
      }
    }

    expect(errors).toEqual([]);
  });

  test('desktop keeps the authoritative playmat without the removed fixed CPU HUD', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const { errors } = await setupGamePage(page, '/#setup');

    await page.locator('[data-testid="game-setup-start"]').click();
    const skip = page.locator('button.mulligan-skip');
    await expect(skip).toBeVisible();
    await skip.click();

    await expect(page.locator('#scaler')).toHaveAttribute('data-playmat-layout', 'desktop');
    await expect(page.locator('[data-testid="spectator-hud"]')).toHaveCount(0);
    await expect(page.locator('.mobile-match-status-rail')).toHaveCount(0);
    await expect(page.locator('.actions-panel--mobile-rail')).toHaveCount(0);
    await expect(page.locator('.board-content')).not.toHaveAttribute('inert', '');
    await expect(page.locator('.board-content')).not.toHaveAttribute('aria-hidden', 'true');

    await page.screenshot({
      path: resolve(captureDirectory, 'match-1440x900.png'),
      fullPage: false,
    });

    expect(errors).toEqual([]);
  });

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
      const initialState = w.__game.createSampleGameState() as {
        pendingEffects: unknown[];
        players: { opp: { deck: unknown[]; remove: unknown[] } };
      };
      initialState.pendingEffects = [];
      initialState.players.opp.deck = [];
      initialState.players.opp.remove = [];
      const log = {
        schemaVersion: 1,
        initialState,
        moves: [
          { turn: 4, player: 'self', move: { kind: 'endTurn' } },
        ],
        result: { winner: 'self', reason: 'deck-out', turns: 5 },
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
