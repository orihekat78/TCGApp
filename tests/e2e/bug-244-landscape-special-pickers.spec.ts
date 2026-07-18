import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  buildGameState,
  dispatchAction,
  expectNoConsoleErrors,
  getGameState,
  setupGamePage,
  waitForActionEnd,
} from './helpers';
import type { GameStateLike } from './helpers';

type AnyState = Record<string, unknown>;

async function primeHuman(page: Page): Promise<void> {
  await page.evaluate(() => {
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
    const store = (window as unknown as { __game: { store: { getState: () => { setSpectatorMode: (v: boolean) => void; setAiPaused: (v: boolean) => void } } } }).__game.store.getState();
    store.setSpectatorMode(false);
    store.setAiPaused(true);
  });
}

async function expectViewportBounds(page: Page, locator: Locator): Promise<void> {
  const [box, viewport] = await Promise.all([
    locator.boundingBox(),
    page.evaluate(() => ({ width: window.innerWidth, height: window.innerHeight })),
  ]);
  expect(box, 'shell has a layout box').not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
  expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height);
}

async function expectFixedScrollableBody(
  page: Page,
  shell: Locator,
  header: Locator,
  body: Locator,
  action: Locator,
): Promise<void> {
  await expect.poll(async () => (await action.boundingBox())?.height ?? 0, {
    message: 'final action reaches its unscaled 44px touch target after the modal entrance animation',
  }).toBeGreaterThanOrEqual(44);
  await expectViewportBounds(page, shell);
  const before = await Promise.all([header.boundingBox(), action.boundingBox()]);
  const metrics = await body.evaluate((node) => {
    const element = node as HTMLElement;
    element.scrollTop = element.scrollHeight;
    return { clientHeight: element.clientHeight, scrollHeight: element.scrollHeight, scrollTop: element.scrollTop };
  });
  expect(metrics.scrollHeight, 'candidate body overflows').toBeGreaterThan(metrics.clientHeight);
  expect(metrics.scrollTop, 'candidate body actually scrolls').toBeGreaterThan(0);
  const after = await Promise.all([header.boundingBox(), action.boundingBox()]);
  expect(after[0]?.y).toBe(before[0]?.y);
  expect(after[1]?.y).toBe(before[1]?.y);
  await expect(action).toBeInViewport();
  const actionBox = await action.boundingBox();
  expect(actionBox?.width).toBeGreaterThanOrEqual(44);
  expect(actionBox?.height).toBeGreaterThanOrEqual(44);
}

test.describe('BUG-244 special picker landscape containment', () => {
  test('CutIn/Disguise: long hand keeps header/pass fixed and pass completes the real contact', async ({ page }, testInfo) => {
    const { errors } = await setupGamePage(page);
    await primeHuman(page);
    await buildGameState(page, (gs: GameStateLike) => {
      const g = gs as unknown as AnyState;
      const players = g.players as { self: AnyState; opp: AnyState };
      const makeCharacter = (cardId: string, uid: string, state = 'active') => ({ cardId, uid, state, isNamed: false, enterOrder: 1, setCards: [], stackedCards: 0, keywordOverrides: { granted: [], disabledOriginal: false }, apOverride: null, lpOverride: null, turnEffects: { contactImmune: false, removeOnTurnEnd: false }, declaredUseCount: {} });
      players.self.partner = { cardId: 'D08001', state: 'active', location: 'partner-area' };
      players.self.case = { cardId: 'D08026', status: 'investigation', requiredEvidence: 7, colors: ['white'], declaredUseCount: {} };
      players.self.scene = [makeCharacter('D08005', 'self-1')];
      players.self.hand = Array.from({ length: 12 }, () => 'B03129');
      players.self.deck = ['D08013'];
      players.self.evidence = [];
      players.self.remove = [];
      players.self.file = Array.from({ length: 6 }, () => ({ type: 'card-back', cardId: 'D08017' }));
      players.opp.scene = [makeCharacter('D08006', 'opp-1', 'sleep')];
      g.pendingEffects = [];
      g.turn = { number: 3, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    });

    await dispatchAction(page, { type: 'actionDeclareChar', byUid: 'self-1', targetUid: 'opp-1' });
    const modal = page.getByTestId('cid-picker-modal');
    await expect(modal).toBeVisible();
    if (testInfo.project.name === 'mobile-chromium') {
      await expectFixedScrollableBody(page, modal.locator('.cid-modal'), modal.locator('.cid-header'), modal.locator('.cid-body'), page.getByTestId('cid-pass'));
    }
    await page.getByTestId('cid-disg-detail-B03129#0').click();
    await page.locator('.card-expand-close').click();
    await page.getByTestId('cid-disg-detail-B03129#11').click();
    await page.locator('.card-expand-close').click();
    await expect(modal).toBeVisible();
    await expect.poll(() => page.evaluate(() => (window as unknown as { __game: { getState: () => { activeActionId: string | null } } }).__game.getState().activeActionId)).not.toBeNull();
    await page.getByTestId('cid-pass').click();
    await waitForActionEnd(page);
    expectNoConsoleErrors(errors);
  });

  test('Misread: long candidate list keeps header/decline fixed and confirm resolves pending engine state', async ({ page }, testInfo) => {
    const { errors } = await setupGamePage(page);
    await primeHuman(page);
    await buildGameState(page, (gs: GameStateLike) => {
      const g = gs as unknown as AnyState;
      const players = g.players as { self: AnyState; opp: AnyState };
      const makeCharacter = (cardId: string, uid: string, state = 'active') => ({ cardId, uid, state, isNamed: false, enterOrder: 1, setCards: [], stackedCards: 0, keywordOverrides: { granted: [], disabledOriginal: false }, apOverride: null, lpOverride: null, turnEffects: { contactImmune: false, removeOnTurnEnd: false }, declaredUseCount: {} });
      players.self.partner = { cardId: 'D08001', state: 'active', location: 'partner-area' };
      players.self.scene = Array.from({ length: 10 }, (_, index) => makeCharacter('B05080', `misread-${index}`));
      players.self.hand = ['D08005'];
      players.self.deck = ['D08006'];
      players.self.evidence = [];
      players.self.remove = [];
      players.self.file = [];
      players.opp.partner = { cardId: 'D08001', state: 'active', location: 'partner-area' };
      players.opp.case = { cardId: 'D08026', status: 'investigation', requiredEvidence: 6, colors: ['blue'], declaredUseCount: {} };
      players.opp.scene = [makeCharacter('D08013', 'reasoner')];
      players.opp.deck = ['D08005', 'D08006'];
      players.opp.hand = [];
      players.opp.evidence = [];
      players.opp.remove = [];
      players.opp.file = [];
      g.pendingEffects = [];
      g.turn = { number: 6, player: 'opp', phase: 'main', isFirstPlayerFirstTurn: false };
    });

    await dispatchAction(page, { type: 'reasoning', uid: 'reasoner' });
    const modal = page.getByTestId('misread-picker-modal');
    await expect(modal).toBeVisible();
    if (testInfo.project.name === 'mobile-chromium') {
      await expectFixedScrollableBody(page, modal.locator('.misread-picker-modal'), modal.locator('.misread-picker-header'), modal.locator('.misread-picker-body'), page.getByTestId('misread-skip-btn'));
    }
    await page.getByTestId('misread-detail-misread-0').click();
    await page.locator('.card-expand-close').click();
    await page.getByTestId('misread-detail-misread-9').click();
    await page.locator('.card-expand-close').click();
    await expect(modal).toBeVisible();
    await expect.poll(() => page.evaluate(() => (window as unknown as { __game: { getState: () => { pendingMisread: unknown } } }).__game.getState().pendingMisread)).not.toBeNull();
    await page.getByTestId('misread-cand-misread-0').check();
    await page.getByTestId('misread-confirm-btn').click();
    await page.waitForFunction(() => (window as unknown as { __game: { getState: () => { pendingEffectPick: { atomVerb: string } | null } } }).__game.getState().pendingEffectPick?.atomVerb === 'discard');
    expectNoConsoleErrors(errors);
  });

  test('Hirameki: long real ability keeps decline reachable and clears listener pending on skip', async ({ page }, testInfo) => {
    const { errors } = await setupGamePage(page);
    await primeHuman(page);
    await buildGameState(page, (gs: GameStateLike) => {
      const g = gs as unknown as AnyState;
      const players = g.players as { self: AnyState; opp: AnyState };
      players.opp.partner = { cardId: 'D11001', state: 'active', location: 'partner-area' };
      players.self.case = { cardId: 'D08026', status: 'investigation', requiredEvidence: 7, colors: ['blue'], declaredUseCount: {} };
      players.self.evidence = [{ cardId: 'D08013', faceUp: false, origin: { turn: 1, via: 'reasoning' } }];
      players.self.hand = [];
      players.self.deck = Array.from({ length: 25 }, (_, index) => `deck-${index}`);
      g.pendingEffects = [];
    });

    await dispatchAction(page, { type: 'actionAgainstCase', byUid: 'partner:opp', targetPlayer: 'self' });
    const modal = page.getByTestId('hirameki-picker-modal');
    await expect(modal).toBeVisible();
    if (testInfo.project.name === 'mobile-chromium') {
      await expectViewportBounds(page, modal.locator('.hirameki-picker-modal'));
      await expect(page.getByTestId('hirameki-skip-btn')).toBeInViewport();
      const box = await page.getByTestId('hirameki-skip-btn').boundingBox();
      expect(box?.width).toBeGreaterThanOrEqual(44);
      expect(box?.height).toBeGreaterThanOrEqual(44);
    }
    await page.getByTestId('hirameki-source-card-detail').click();
    await page.locator('.card-expand-close').click();
    await expect(modal).toBeVisible();
    await page.getByTestId('hirameki-skip-btn').click();
    await expect.poll(() => page.evaluate(() => (window as unknown as { __game: { getState: () => { pendingHirameki: unknown } } }).__game.getState().pendingHirameki)).toBeNull();
    const state = await getGameState(page);
    expect((state.players.self as { hand: string[] }).hand).toHaveLength(0);
    expectNoConsoleErrors(errors);
  });
});
