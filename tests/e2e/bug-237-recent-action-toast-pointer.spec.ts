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
        { ts: 2, player: 'opp', turn: 1, action: 'handUseCard', target: 'D08007' },
      ];
    });

    const toast = page.getByTestId('recent-action-toast');
    await expect(toast).toBeVisible();
    await expect(toast).toHaveAttribute('role', 'status');
    await expect(toast).toHaveCSS('pointer-events', 'none');

    const remove = page.locator('.remove-area.side-self');
    await expect(remove).toBeVisible();
    await expect(toast).toHaveAttribute('data-player', 'opp', { timeout: 2_500 });

    const hit = await page.evaluate(() => {
      const toastElement = document.querySelector<HTMLElement>('[data-testid="recent-action-toast"]')!;
      const toastRect = toastElement.getBoundingClientRect();
      const removeRect = document.querySelector<HTMLElement>('.remove-area.side-self')!.getBoundingClientRect();
      const x = removeRect.left + removeRect.width / 2;
      const y = removeRect.top + removeRect.height / 2;
      const target = document.elementFromPoint(x, y);
      return {
        removeCenterIsCoveredByToast:
          x >= toastRect.left && x <= toastRect.right && y >= toastRect.top && y <= toastRect.bottom,
        removeReceivesHit: target?.closest('.remove-area.side-self') !== null,
        tag: target?.tagName,
        className: target?.getAttribute('class'),
      };
    });
    if (testInfo.project.name === 'mobile-chromium') {
      expect(hit.removeCenterIsCoveredByToast, `landscape fixture must cover self remove: ${JSON.stringify(hit)}`).toBe(true);
    }
    expect(hit.removeReceivesHit, `toast must not intercept the covered self remove hit: ${JSON.stringify(hit)}`).toBe(true);

    await remove.click();
    await expect(page.locator('.card-list-modal')).toBeVisible();
    expect(errors).toEqual([]);
  });
});
