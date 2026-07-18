import { test, expect, type Locator, type Page } from '@playwright/test';
import { buildGameState, expectNoConsoleErrors, setupGamePage } from './helpers';

async function expectViewportBounded(page: Page, shell: Locator): Promise<void> {
  const viewport = page.viewportSize();
  expect(viewport).not.toBeNull();
  const box = await shell.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewport!.width);
  expect(box!.y + box!.height).toBeLessThanOrEqual(viewport!.height);
  expect(await shell.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true);
}

async function openAndCloseDetail(modal: Locator, detail: Locator): Promise<void> {
  await detail.click();
  const close = modal.page().locator('.card-expand-close');
  await expect(close).toBeVisible();
  await close.click();
  await expect(modal).toBeVisible();
}

async function expectTouchTarget(locator: Locator): Promise<void> {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.height).toBeGreaterThanOrEqual(44);
}

test('BUG-241 Pixel 5 landscape effect picker scrolls, keeps details, and skips the exact pending pick', async ({ page }) => {
  const { errors } = await setupGamePage(page);
  await buildGameState(page, (state) => { (state as unknown as { pendingEffects: unknown[] }).pendingEffects = []; });
  await page.evaluate(() => {
    const store = (window as unknown as { __game: { store: { getState: () => { setPendingEffectPick: (value: unknown) => void } } } }).__game.store.getState();
    store.setPendingEffectPick({
      player: 'self',
      candidates: Array.from({ length: 8 }, (_, index) => ({ uid: `bug241-effect-${index}`, cardId: 'D08003', player: 'opp' })),
      atomVerb: 'stackedCardPick', atomArgs: {}, nMin: 0, nMax: 1,
      source: { cardId: 'B04026', abilityId: 'a1' },
    });
  });
  await expect.poll(() => page.evaluate(() => (window as unknown as { __game: { getState: () => { pendingEffectPick: unknown } } }).__game.getState().pendingEffectPick)).toEqual({
    player: 'self',
    candidates: Array.from({ length: 8 }, (_, index) => ({ uid: `bug241-effect-${index}`, cardId: 'D08003', player: 'opp' })),
    atomVerb: 'stackedCardPick', atomArgs: {}, nMin: 0, nMax: 1,
    source: { cardId: 'B04026', abilityId: 'a1' },
  });

  const modal = page.getByTestId('effect-picker-modal');
  await expect(modal).toBeVisible();
  await expectViewportBounded(page, modal.locator('.effect-picker-modal'));
  const details = modal.getByTestId(/effect-pick-detail-bug241-effect-/);
  await expect(details).toHaveCount(8);
  await openAndCloseDetail(modal, details.first());
  await openAndCloseDetail(modal, details.last());
  const skip = modal.getByTestId('effect-picker-skip');
  await expectTouchTarget(skip);
  await skip.click();
  await expect(modal).toBeHidden();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __game: { getState: () => { pendingEffectPick: unknown } } }).__game.getState().pendingEffectPick)).toBeNull();
  expectNoConsoleErrors(errors);
});

test('BUG-241 Pixel 5 landscape choose-intercept scrolls hand details and declines the exact pending response', async ({ page }) => {
  const { errors } = await setupGamePage(page);
  await page.evaluate(() => {
    type BrowserGame = {
      __game: {
        createSampleGameState: () => { players: { self: { hand: string[] } } };
        store: {
          getState: () => {
            setGameState: (state: unknown) => void;
            setPendingChooseIntercept: (value: unknown) => void;
          };
        };
      };
    };
    const game = (window as unknown as BrowserGame).__game;
    const state = game.createSampleGameState();
    state.players.self.hand = Array.from({ length: 8 }, () => 'B04003');
    const store = game.store.getState();
    store.setGameState(state);
    store.setPendingChooseIntercept({ player: 'self', protector: { uid: 'p', cardId: 'B04003', abilityId: 'a1' }, targetUid: 't' });
  });
  await expect.poll(() => page.evaluate(() => (window as unknown as { __game: { getState: () => { pendingChooseIntercept: unknown } } }).__game.getState().pendingChooseIntercept)).toEqual({
    player: 'self', protector: { uid: 'p', cardId: 'B04003', abilityId: 'a1' }, targetUid: 't',
  });

  const modal = page.getByTestId('choose-intercept-modal');
  await expect(modal).toBeVisible();
  await expectViewportBounded(page, modal.locator('.cp-modal'));
  const details = modal.getByTestId('selectable-card-tile-detail');
  await expect(details).toHaveCount(8);
  await openAndCloseDetail(modal, details.first());
  await openAndCloseDetail(modal, details.last());
  const decline = modal.getByTestId('choose-intercept-decline');
  await expectTouchTarget(decline);
  await decline.click();
  await expect(modal).toBeHidden();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __game: { getState: () => { pendingChooseIntercept: unknown } } }).__game.getState().pendingChooseIntercept)).toBeNull();
  expectNoConsoleErrors(errors);
});

test('BUG-241 Pixel 5 landscape set-card replacement scrolls candidate details and removes the exact pending card', async ({ page }) => {
  const { errors } = await setupGamePage(page);
  await buildGameState(page, (state) => { (state as unknown as { pendingEffects: unknown[] }).pendingEffects = []; });
  await page.evaluate(() => {
    const store = (window as unknown as { __game: { store: { getState: () => { setPendingSetCardReplacement: (value: unknown) => void } } } }).__game.store.getState();
    store.setPendingSetCardReplacement({
      player: 'self', fromUid: 'host', setCardInstanceId: 'set:1',
      candidates: Array.from({ length: 8 }, (_, index) => ({ uid: `bug241-replacement-${index}`, cardId: 'D08001' })),
      source: { cardId: 'B02052', abilityId: 'a3', uid: 'host' },
    });
  });
  await expect.poll(() => page.evaluate(() => (window as unknown as { __game: { getState: () => { pendingSetCardReplacement: unknown } } }).__game.getState().pendingSetCardReplacement)).toEqual({
    player: 'self', fromUid: 'host', setCardInstanceId: 'set:1',
    candidates: Array.from({ length: 8 }, (_, index) => ({ uid: `bug241-replacement-${index}`, cardId: 'D08001' })),
    source: { cardId: 'B02052', abilityId: 'a3', uid: 'host' },
  });

  const modal = page.getByTestId('set-card-replacement-modal');
  await expect(modal).toBeVisible();
  await expectViewportBounded(page, modal.locator('.cp-modal'));
  const details = modal.getByTestId('selectable-card-tile-detail');
  await expect(details).toHaveCount(8);
  await openAndCloseDetail(modal, details.first());
  await openAndCloseDetail(modal, details.last());
  const decline = modal.getByTestId('set-card-replacement-decline');
  await expectTouchTarget(decline);
  await decline.click();
  await expect(modal).toBeHidden();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __game: { getState: () => { pendingSetCardReplacement: unknown } } }).__game.getState().pendingSetCardReplacement)).toBeNull();
  expectNoConsoleErrors(errors);
});
