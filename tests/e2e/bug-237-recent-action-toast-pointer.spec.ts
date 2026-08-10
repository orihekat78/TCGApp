import { expect, test, type Page } from '@playwright/test';
import { buildCausalGameState, setupGamePage } from './helpers';

async function humanMode(page: Page): Promise<void> {
  await page.evaluate(() => {
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
    const app = window as unknown as {
      __game: { store: { getState: () => { setSpectatorMode: (value: boolean) => void } } };
    };
    app.__game.store.getState().setSpectatorMode(false);
  });
}

test.describe('BUG-237: presentation strip never intercepts board clicks', () => {
  test('public causal event stays announced while the self remove control opens normally', async ({ page }) => {
    const { errors } = await setupGamePage(page);
    await humanMode(page);
    await buildCausalGameState(page, (state) => {
      state.players.self.remove = ['D08003'];
    });

    const committed = await page.evaluate(async () => {
      const loadCausal = new Function('return import("/src/engine/log/causal.ts")') as () => Promise<{
        appendCausal: (state: unknown, input: unknown) => void;
      }>;
      const { appendCausal } = await loadCausal();
      const app = window as unknown as {
        __game: {
          store: {
            getState: () => {
              gameState: unknown;
              setGameState: (state: unknown) => boolean;
            };
          };
        };
      };
      const store = app.__game.store.getState();
      const state = structuredClone(store.gameState);
      appendCausal(state, {
        actor: 'self',
        kind: 'use',
        source: { kind: 'player', side: 'self' },
        targets: [{ kind: 'zone', side: 'self', zone: 'remove' }],
        outcome: { type: 'state', state: 'success' },
      });
      return store.setGameState(state);
    });
    expect(committed).toBe(true);

    const presentation = page.getByTestId('presentation-causal-host');
    await expect(presentation).toBeVisible();
    await expect(presentation).toHaveAttribute('role', 'status');
    await expect(presentation).toHaveCSS('pointer-events', 'none');
    await expect(page.getByTestId('recent-action-toast')).toHaveCount(0);

    const remove = page.locator('.remove-area.side-self');
    await expect(remove).toBeVisible();
    await remove.click();
    await expect(page.locator('.card-list-modal')).toBeVisible();
    expect(errors).toEqual([]);
  });
});
