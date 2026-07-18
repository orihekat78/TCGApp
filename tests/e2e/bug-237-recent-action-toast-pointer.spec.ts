import { expect, test, type Page } from '@playwright/test';
import { buildGameState, setupGamePage } from './helpers';

async function humanMode(page: Page): Promise<void> {
  await page.evaluate(() => {
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
    const app = window as unknown as {
      __game: { store: { getState: () => { setSpectatorMode: (value: boolean) => void } } };
    };
    app.__game.store.getState().setSpectatorMode(false);
  });
}

test.describe('BUG-237: recent action toast never intercepts board clicks', () => {
  test('toast stays announced while the self remove control opens normally', async ({ page }, testInfo) => {
    const { errors } = await setupGamePage(page);
    await humanMode(page);
    await buildGameState(page, (state) => {
      state.players.self.remove = ['D08003'];
      state.log = [
        { ts: 1, player: 'self', turn: 1, action: 'handUseCard', target: 'D08003' },
      ];
    });

    const toast = page.getByTestId('recent-action-toast');
    await expect(toast).toBeVisible();
    await expect(toast).toHaveAttribute('role', 'status');
    await expect(toast).toHaveCSS('pointer-events', 'none');
    await expect(toast).toHaveAttribute('data-player', 'self');

    const remove = page.locator('.remove-area.side-self');
    await expect(remove).toBeVisible();
    await page.evaluate(() => {
      const app = window as unknown as {
        __game: {
          getState: () => { gameState: { log: unknown[] } };
          setGameState: (state: unknown) => void;
        };
      };
      const state = app.__game.getState().gameState;
      app.__game.setGameState({
        ...state,
        log: [
          ...state.log,
          // 長い target により toast-target の中心を実際の自己リムーブ領域へ置く。
          { ts: 2, player: 'opp', turn: 1, action: 'handUseCard', target: 'TOAST-CHILD-XX' },
        ],
      });
    });
    await expect(toast).toHaveAttribute('data-player', 'opp', { timeout: 2_500 });

    const hit = await page.evaluate(() => {
      const toastElement = document.querySelector<HTMLElement>('[data-testid="recent-action-toast"]')!;
      const toastRect = toastElement.getBoundingClientRect();
      const removeRect = document.querySelector<HTMLElement>('.remove-area.side-self')!.getBoundingClientRect();
      const childRect = toastElement.querySelector<HTMLElement>('.toast-target')!.getBoundingClientRect();
      const x = childRect.left + childRect.width / 2;
      const y = childRect.top + childRect.height / 2;
      const target = document.elementFromPoint(x, y);
      return {
        targetCenterIsInsideToast:
          x >= toastRect.left && x <= toastRect.right && y >= toastRect.top && y <= toastRect.bottom,
        targetCenterCoversRemove:
          x >= removeRect.left && x <= removeRect.right && y >= removeRect.top && y <= removeRect.bottom,
        removeReceivesHit: target?.closest('.remove-area.side-self') !== null,
        x,
        y,
      };
    });
    if (testInfo.project.name === 'mobile-chromium') {
      expect(hit.targetCenterIsInsideToast, `toast child center must be inside toast: ${JSON.stringify(hit)}`).toBe(true);
      expect(hit.targetCenterCoversRemove, `toast child center must cover self remove: ${JSON.stringify(hit)}`).toBe(true);
      expect(hit.removeReceivesHit, `toast child must not intercept the covered self remove hit: ${JSON.stringify(hit)}`).toBe(true);
      await page.mouse.click(hit.x, hit.y);
    } else {
      await remove.click();
    }
    await expect(page.locator('.card-list-modal')).toBeVisible();
    expect(errors).toEqual([]);
  });
});
