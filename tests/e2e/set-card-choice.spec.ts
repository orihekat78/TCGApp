import { test, expect } from '@playwright/test';
import { setupGamePage, buildGameState } from './helpers';

test('set-card choice shows loaded opaque backs with distinct labels and resolves the keyboard-selected instance', async ({ page }) => {
  await page.setViewportSize({ width: 851, height: 393 });
  const { errors } = await setupGamePage(page);
  await buildGameState(page, (gs) => {
    (gs as unknown as Record<string, unknown>).pendingEffects = [];
  });
  await page.evaluate(() => {
    const w = window as unknown as { __game: { store: { getState: () => { setPendingSetCardChoice: (v: unknown) => void } } } };
    w.__game.store.getState().setPendingSetCardChoice({
      player: 'self', hostUid: 'opaque-host',
      entries: [{ instanceId: 'set:1', ordinal: 1 }, { instanceId: 'set:2', ordinal: 2 }],
      source: { cardId: 'B02039', abilityId: 'a1', uid: 'yusaku' },
    });
  });
  await expect(page.locator('[data-testid="set-card-choice-modal"]')).toBeVisible();
  const first = page.getByTestId('set-card-choice-1');
  const second = page.getByTestId('set-card-choice-2');
  await expect(first).toHaveAccessibleName('Set card 1 を選択');
  await expect(second).toHaveAccessibleName('Set card 2 を選択');
  const names = await page.locator('button[data-testid^="set-card-choice-"]').evaluateAll((choices) =>
    choices.map((choice) => choice.getAttribute('aria-label')),
  );
  expect(new Set(names).size).toBe(2);
  for (const choice of [first, second]) {
    const image = choice.locator('img.card-art.selectable-card-tile__back-art');
    await expect(image).toBeVisible();
    await expect.poll(() => image.evaluate((node) => {
      const back = node as HTMLImageElement;
      return back.complete && back.naturalWidth > 0 && back.currentSrc.startsWith('data:image/svg+xml');
    })).toBe(true);
    await expect(image).toHaveAttribute('alt', '');
  }
  await expect(page.locator('[data-testid="set-card-choice-modal"]')).not.toContainText('SECRET');
  await expect(page.locator('[data-testid="set-card-choice-modal"]')).not.toContainText('B02039');
  await second.focus();
  await second.press('Enter');
  await expect(page.locator('[data-testid="set-card-choice-modal"]')).toBeHidden();
  await expect.poll(() => page.evaluate(() => {
    const w = window as unknown as { __game: { getState: () => { pendingSetCardChoice: unknown } } };
    return w.__game.getState().pendingSetCardChoice;
  })).toBeNull();
  expect(errors).toEqual([]);
});
