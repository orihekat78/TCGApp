import { expect, test } from '@playwright/test';

test('MATCH画面で任意効果の決定モーダルを表示する', async ({ page }) => {
  await page.goto('/#match');
  await page.waitForFunction(() => typeof (globalThis as { __metaGame?: unknown }).__metaGame !== 'undefined');

  await page.evaluate(async () => {
    const startUrl = new URL('/src/util/customGameStart.ts', location.origin).href;
    const decksUrl = new URL('/src/data/sampleDeck.ts', location.origin).href;

    const { customGameStart } = await import(startUrl);
    const { SAMPLE_DECK, SAMPLE_DECK_OPP } = await import(decksUrl);
    const state = await customGameStart(SAMPLE_DECK, SAMPLE_DECK_OPP, {
      spectator: true,
      firstPlayer: 'self',
    });
    const bridge = (globalThis as unknown as {
      __metaGame: { getState: () => {
        setGameState: (state: unknown) => void;
        setPendingEffectOptional: (pending: unknown) => void;
      } };
    }).__metaGame;
    const store = bridge.getState();
    store.setGameState(state);
    store.setPendingEffectOptional({
      player: 'self',
      source: { cardId: 'B09056P', abilityId: 'a1', uid: 'b09056p-self-1' },
    });
  });

  await expect(page.getByTestId('optional-picker-modal')).toBeVisible();
  await expect(page.getByTestId('opt-run-yes')).toBeVisible();
  await expect(page.getByTestId('opt-run-no')).toBeVisible();
});
