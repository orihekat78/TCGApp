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
    const w = window as unknown as {
      __game: { store: { getState: () => { setSpectatorMode: (v: boolean) => void; setAiPaused: (v: boolean) => void } } };
    };
    const store = w.__game.store.getState();
    store.setSpectatorMode(false);
    store.setAiPaused(true);
  });
}

async function expectTouchTarget(detail: Locator): Promise<void> {
  await detail.scrollIntoViewIfNeeded();
  await expect(detail).toBeVisible();
  await expect(detail).toBeInViewport();
  const box = await detail.boundingBox();
  expect(box, 'detail control has a box').not.toBeNull();
  expect(box!.width, 'detail width').toBeGreaterThanOrEqual(44);
  expect(box!.height, 'detail height').toBeGreaterThanOrEqual(44);
}

async function expectWithinViewport(page: Page, locator: Locator): Promise<void> {
  const box = await locator.boundingBox();
  expect(box, 'element has a box').not.toBeNull();
  const viewport = await page.evaluate(() => ({ width: window.innerWidth, height: window.innerHeight }));
  expect(box!.x, 'element left').toBeGreaterThanOrEqual(0);
  expect(box!.y, 'element top').toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width, 'element right').toBeLessThanOrEqual(viewport.width);
  expect(box!.y + box!.height, 'element bottom').toBeLessThanOrEqual(viewport.height);
}

async function expectPublicCardArt(primary: Locator, cardId: string, imageFile: string): Promise<void> {
  const image = primary.locator('img');
  await expect(image).toBeVisible();
  await expect.poll(
    () => image.evaluate((node, expectedImageFile) => {
      const art = node as HTMLImageElement;
      return art.complete
        && art.naturalWidth > 0
        && !art.currentSrc.startsWith('data:')
        && art.currentSrc.includes(expectedImageFile);
    }, imageFile),
    { message: `${cardId} uses its loaded card image rather than a placeholder`, timeout: 10_000 },
  ).toBe(true);
}

async function expectHiddenCardBack(hidden: Locator): Promise<void> {
  const image = hidden.locator('img');
  await expect(image).toBeVisible();
  await expect.poll(
    () => image.evaluate((node) => {
      const art = node as HTMLImageElement;
      return art.complete && art.naturalWidth > 0 && art.currentSrc.startsWith('data:');
    }),
    { message: 'face-down evidence is a loaded generic back, never a card network image', timeout: 10_000 },
  ).toBe(true);
}

async function assertDetailClick(page: Page, detail: Locator): Promise<void> {
  await expectTouchTarget(detail);

  await detail.click();
  await expect(page.locator('.card-expand-modal-backdrop')).toBeVisible();
  await page.locator('.card-expand-close').click();
  await expect(page.locator('.card-expand-modal-backdrop')).toBeHidden();

}

test.describe('real mounted card-choice details', () => {
  test('EffectPicker: B08019 preserves multi-pick resolution while public details expand', async ({ page }) => {
    const { errors } = await setupGamePage(page);
    await primeHuman(page);
    await buildGameState(page, (gs: GameStateLike) => {
      const g = gs as unknown as AnyState;
      const mk = (cardId: string, uid: string, state = 'active', setCards: { cardId: string; faceUp: boolean }[] = []) => ({ cardId, uid, state, isNamed: false, enterOrder: 1, setCards, stackedCards: 0, keywordOverrides: { granted: [], disabledOriginal: false }, apOverride: null, lpOverride: null, turnEffects: { contactImmune: false, removeOnTurnEnd: false }, declaredUseCount: {} });
      const players = g.players as { self: AnyState; opp: AnyState };
      players.self.partner = { cardId: 'D08001', state: 'active', location: 'partner-area' };
      players.self.scene = [
        mk('B08019', 'self-1'),
        mk('D08011', 'D08011#0', 'active', [
          { cardId: 'D08003', faceUp: false },
          { cardId: 'D08011', faceUp: false },
        ]),
      ];
      players.opp.scene = [mk('D08013', 'opp-1', 'active', [{ cardId: 'D08007', faceUp: false }])];
      players.self.hand = [];
      players.self.deck = ['D08026'];
      players.opp.hand = [];
      g.pendingEffects = [];
      g.turn = { number: 3, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    });

    await page.locator('[data-action-id="declared-ability"]').click();
    await page.locator('[data-uid="self-1"]').click();
    await page.locator('.confirm-ok').click();
    await page.getByTestId('opt-run-yes').click();

    const primary = page.getByTestId('effect-pick-cand-D08011#0');
    await expectPublicCardArt(primary, 'D08011', '1743743093474254.jpg');
    const detail = page.getByTestId('effect-pick-detail-D08011#0');
    await expectWithinViewport(page, page.getByTestId('effect-picker-modal'));
    await expectWithinViewport(page, detail);
    await expect(detail).toHaveAccessibleName(/円谷光彦.*詳細を表示/);
    await expect(page.getByTestId('effect-pick-detail-opp-1')).toHaveAccessibleName(/吉田歩美.*詳細を表示/);
    const detailNames = await page.locator('.effect-picker-detail').evaluateAll((buttons) =>
      buttons.map((button) => button.getAttribute('aria-label')),
    );
    expect(new Set(detailNames).size).toBe(detailNames.length);
    await assertDetailClick(page, detail);
    await expect(page.getByTestId('effect-picker-modal')).toBeVisible();

    await primary.click();
    await page.getByTestId('effect-pick-cand-opp-1').click();
    await page.getByTestId('effect-picker-confirm').click();
    await page.waitForFunction(() => {
      const w = window as unknown as { __game: { getState: () => { gameState: { players: { self: { hand: string[] } } } } } };
      return w.__game.getState().gameState.players.self.hand.length === 1;
    });
    const state = await getGameState(page);
    expect((state.players.self as { scene: { uid: string; setCards: unknown[] }[] }).scene.find((c) => c.uid === 'D08011#0')!.setCards).toHaveLength(1);
    expect((state.players.opp as { scene: { uid: string; setCards: unknown[] }[] }).scene.find((c) => c.uid === 'opp-1')!.setCards).toHaveLength(0);
    expectNoConsoleErrors(errors);
  });

  test('EffectPicker: face-down evidence exposes no identity or detail control', async ({ page }) => {
    const { errors } = await setupGamePage(page);
    await primeHuman(page);
    await buildGameState(page, (gs: GameStateLike) => {
      const g = gs as unknown as AnyState;
      const self = (g.players as { self: AnyState }).self;
      self.evidence = [{ cardId: 'D08003', faceUp: false, origin: { turn: 1, via: 'reasoning' } }];
    });
    await page.evaluate(() => {
      const w = window as unknown as {
        __game: { store: { getState: () => { setPendingEffectPick: (p: unknown) => void } } };
      };
      w.__game.store.getState().setPendingEffectPick({
        player: 'self',
        candidates: [{ uid: 'evidence:self:0', cardId: 'D08003', player: 'self' }],
        atomVerb: 'charSetCard',
        atomArgs: {},
        nMin: 1,
        nMax: 1,
        source: { cardId: 'B04026', abilityId: 'a1' },
      });
    });

    const hidden = page.getByTestId('effect-pick-cand-evidence:self:0');
    await expect(hidden).toBeVisible();
    await expectHiddenCardBack(hidden);
    await expect(hidden).not.toContainText('D08003');
    await expect(hidden).not.toContainText('江戸川コナン');
    await expect(hidden.locator('img')).not.toHaveAttribute('alt', /江戸川コナン/);
    await expect(page.getByTestId('effect-pick-detail-evidence:self:0')).toHaveCount(0);
    await expect(hidden).not.toHaveAttribute('data-card-id');
    expectNoConsoleErrors(errors);
  });

  test('DeckReveal: landscape detail inspection pauses then resumes reveal progression', async ({ page }) => {
    await page.setViewportSize({ width: 851, height: 393 });
    const { errors } = await setupGamePage(page);
    await primeHuman(page);
    await buildGameState(page, (gs: GameStateLike) => {
      const g = gs as unknown as AnyState;
      g.pendingEffects = [];
      g.turn = { number: 3, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    });
    await page.evaluate(() => {
      const w = window as unknown as {
        __game: { store: { getState: () => { setPendingDeckReveal: (p: unknown) => void } } };
      };
      w.__game.store.getState().setPendingDeckReveal({
        player: 'self',
        visibility: 'public',
        viewer: 'all',
        revealed: ['D11020', 'D08003'],
        matched: 'D08003',
      });
    });
    const primary = page.getByTestId('deck-reveal-card-0');
    await expect(primary).toBeVisible();
    const detail = page.getByTestId('deck-reveal-detail-0');
    // The first of two cards becomes stable while the reveal phase still has
    // one second left. A normal click must remain actionable on a real phone.
    await primary.evaluate(async (element) => {
      await Promise.all(element.getAnimations().map((animation) => animation.finished));
    });
    await page.waitForTimeout(250);
    await expect(page.getByTestId('deck-reveal-list')).toHaveClass(/phase-reveal/);
    await expect(detail).toBeVisible();
    await expect(detail).toBeInViewport();
    const detailBox = await detail.boundingBox();
    expect(detailBox, 'detail control has a box').not.toBeNull();
    expect(detailBox!.width, 'detail width').toBeGreaterThanOrEqual(44);
    expect(detailBox!.height, 'detail height').toBeGreaterThanOrEqual(44);
    await detail.click();
    await expect(page.locator('.card-expand-modal-backdrop')).toBeVisible();
    // The expanded view pauses the reveal timer, so a slow official-CDN image
    // cannot make the source card disappear while its public art is verified.
    await expectPublicCardArt(primary, 'D11020', '1775608977402003.jpg');
    // More than the remaining timeline elapses, but the overlay remains
    // while the user reads the expanded card.
    await page.waitForTimeout(3500);
    await expect(page.getByTestId('deck-reveal-overlay')).toBeVisible();
    await page.locator('.card-expand-close').click();
    await expect(page.getByTestId('deck-reveal-overlay')).toBeVisible();
    // Continuation uses the saved remainder; a fresh 3600ms timeline would fail.
    await page.getByTestId('deck-reveal-overlay').waitFor({ state: 'detached', timeout: 3250 });
    expectNoConsoleErrors(errors);
  });

  test('Misread: B05080 resolves its selected ability after public detail inspection', async ({ page }) => {
    const { errors } = await setupGamePage(page);
    await primeHuman(page);
    await buildGameState(page, (gs: GameStateLike) => {
      const g = gs as unknown as AnyState;
      const mk = (cardId: string, uid: string, state = 'active') => ({ cardId, uid, state, isNamed: false, enterOrder: 1, setCards: [], stackedCards: 0, keywordOverrides: { granted: [], disabledOriginal: false }, apOverride: null, lpOverride: null, turnEffects: { contactImmune: false, removeOnTurnEnd: false }, declaredUseCount: {} });
      const players = g.players as { self: AnyState; opp: AnyState };
      players.self.partner = { cardId: 'D08001', state: 'active', location: 'partner-area' };
      players.self.scene = [mk('B05080', 'hyd#1')];
      // This case exercises Misread only. With no hand, B05080's independent
      // optional discard chain has no candidate and resolves automatically.
      players.self.hand = [];
      players.self.deck = ['D08006'];
      players.self.evidence = [];
      players.self.remove = [];
      players.self.file = [];
      players.opp.partner = { cardId: 'D08001', state: 'active', location: 'partner-area' };
      players.opp.case = { cardId: 'D08026', status: 'investigation', requiredEvidence: 6, colors: ['blue'], declaredUseCount: {} };
      players.opp.scene = [mk('D08013', 'enemy#1')];
      players.opp.deck = ['D08005', 'D08006'];
      players.opp.hand = [];
      players.opp.evidence = [];
      players.opp.remove = [];
      players.opp.file = [];
      g.pendingEffects = [];
      g.turn = { number: 6, player: 'opp', phase: 'main', isFirstPlayerFirstTurn: false };
    });

    await dispatchAction(page, { type: 'reasoning', uid: 'enemy#1' });
    const primary = page.getByTestId('misread-card-hyd#1');
    await expect(primary).toBeVisible();
    await expectPublicCardArt(primary, 'B05080', '1745322226168482.jpg');
    await assertDetailClick(page, page.getByTestId('misread-detail-hyd#1'));
    await page.getByTestId('misread-cand-hyd#1').check();
    await page.getByTestId('misread-confirm-btn').click();
    await expect(page.getByTestId('misread-picker-modal')).toBeHidden();
    expect((await getGameState(page)).players.self.scene.find((character) => character.uid === 'hyd#1')?.state).toBe('sleep');
    expect(await page.evaluate(() => {
      const state = (window as unknown as { __game: { getState: () => { pendingMisread: unknown; pendingEffectPick: unknown } } }).__game.getState();
      return { pendingMisread: state.pendingMisread, pendingEffectPick: state.pendingEffectPick };
    })).toEqual({ pendingMisread: null, pendingEffectPick: null });
    expectNoConsoleErrors(errors);
  });

  test('CutIn/Disguise: B03129 detail inspection preserves disguise resolution', async ({ page }) => {
    const { errors } = await setupGamePage(page);
    await primeHuman(page);
    await buildGameState(page, (gs: GameStateLike) => {
      const g = gs as unknown as AnyState;
      const mk = (cardId: string, uid: string, state = 'active') => ({ cardId, uid, state, isNamed: false, enterOrder: 1, setCards: [], stackedCards: 0, keywordOverrides: { granted: [], disabledOriginal: false }, apOverride: null, lpOverride: null, turnEffects: { contactImmune: false, removeOnTurnEnd: false }, declaredUseCount: {} });
      const players = g.players as { self: AnyState; opp: AnyState };
      players.self.partner = { cardId: 'D08001', state: 'active', location: 'partner-area' };
      players.self.case = { cardId: 'D08026', status: 'investigation', requiredEvidence: 7, colors: ['white'], declaredUseCount: {} };
      players.self.scene = [mk('D08005', 's1')];
      players.self.hand = ['B03129', 'D08017', 'D08003'];
      players.self.deck = ['D08013'];
      players.self.evidence = [];
      players.self.remove = [];
      players.self.file = Array.from({ length: 6 }, () => ({ type: 'card-back', cardId: 'D08017' }));
      players.opp.scene = [mk('D08006', 'o1', 'sleep')];
      g.pendingEffects = [];
      g.turn = { number: 3, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    });

    await dispatchAction(page, { type: 'actionDeclareChar', byUid: 's1', targetUid: 'o1' });
    const primary = page.getByTestId('cid-disg-card:self:hand:B03129#0');
    await expect(primary).toBeVisible();
    await expectPublicCardArt(primary, 'B03129', '1729133510413412.jpg');
    await assertDetailClick(page, page.getByTestId('cid-disg-detail-card:self:hand:B03129#0'));
    await primary.click();
    await waitForActionEnd(page);
    const state = await getGameState(page);
    expect((state.players.self as { scene: { uid: string; cardId: string }[] }).scene.find((card) => card.uid === 's1')?.cardId).toBe('B03129');
    expectNoConsoleErrors(errors);
  });
});
