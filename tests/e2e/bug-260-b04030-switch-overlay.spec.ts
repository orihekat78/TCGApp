import { expect, test } from '@playwright/test';
import { buildGameState, expectNoConsoleErrors, setupGamePage, type GameStateLike } from './helpers';

async function openB04030EnterChoice(page: Parameters<typeof setupGamePage>[0]): Promise<void> {
  await buildGameState(page, (gs: GameStateLike) => {
    const player = gs.players.self as unknown as { scene: unknown[] };
    player.scene = Array.from({ length: 5 }, (_, index) => ({
      uid: `b04030-victim-${index}`, cardId: 'B04030', state: 'active', isNamed: false, enterOrder: index,
      setCards: [], stackedCards: 0, keywordOverrides: { granted: [], disabledOriginal: false }, apOverride: null,
      lpOverride: null, turnEffects: { contactImmune: false, removeOnTurnEnd: false }, declaredUseCount: {},
    }));
  });
  await page.evaluate(() => {
    const game = (window as unknown as { __game: { store: { setState: (state: unknown) => void } } }).__game;
    game.store.setState({
      pendingEffectChoice: {
        player: 'self',
        source: { player: 'self', area: 'scene', cardId: 'B04030', uid: 'kaito', abilityId: 'a1' },
        options: [{ index: 0, label: 'hand' }, { index: 1, label: 'enter', sceneEnter: true }],
      },
    });
  });
  await expect(page.getByTestId('choice-picker-modal')).toBeVisible();
  await page.getByTestId('cp-opt-1').click();
  await expect(page.getByTestId('choice-picker-modal')).toBeHidden();
  await expect(page.getByTestId('switch-victim-overlay')).toBeVisible();
}

test.describe('BUG-260 B04030 full-scene choice switch', () => {
  test('selected enter option releases the overlay so a victim card receives the click', async ({ page }) => {
    const { errors } = await setupGamePage(page);
    await openB04030EnterChoice(page);

    await page.locator('[data-uid="b04030-victim-0"]').click();
    await expect(page.getByTestId('switch-victim-overlay')).toBeHidden();

    expectNoConsoleErrors(errors);
  });

  test('851x393 keeps victim cards tappable and the explicit cancel target at least 44px', async ({ page }) => {
    await page.setViewportSize({ width: 851, height: 393 });
    const { errors } = await setupGamePage(page);
    await openB04030EnterChoice(page);

    const cancelBox = await page.getByTestId('switch-victim-cancel').boundingBox();
    expect(cancelBox?.width).toBeGreaterThanOrEqual(44);
    expect(cancelBox?.height).toBeGreaterThanOrEqual(44);
    await page.getByTestId('scene-card-pick-b04030-victim-0').click();
    await expect(page.getByTestId('switch-victim-overlay')).toBeHidden();

    expectNoConsoleErrors(errors);
  });

  test('switch cancellation remains explicit and outside clicks do not close it', async ({ page }) => {
    const { errors } = await setupGamePage(page);
    await openB04030EnterChoice(page);

    await page.mouse.click(1, 1);
    await expect(page.getByTestId('switch-victim-overlay')).toBeVisible();
    await page.getByTestId('switch-victim-cancel').click();
    await expect(page.getByTestId('switch-victim-overlay')).toBeHidden();

    expectNoConsoleErrors(errors);
  });
});
