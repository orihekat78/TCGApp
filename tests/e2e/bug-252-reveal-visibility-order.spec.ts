import { expect, test, type Page } from '@playwright/test';
import { buildGameState, dispatchAction, setupGamePage } from './helpers';

type AnyState = Record<string, unknown>;
type MutableSide = Record<string, unknown>;

async function prime(page: Page): Promise<void> {
  // setupGamePage already waited for the Vite dev bridge. Hash-only routing avoids
  // replacing the document (and transiently losing window.__game on mobile).
  await page.evaluate(() => {
    if (window.location.hash !== '#match') window.location.hash = '#match';
  });
  await page.waitForFunction(() => typeof (window as unknown as { __game?: unknown }).__game !== 'undefined');
  await page.evaluate(() => {
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
    const store = (window as unknown as { __game: { store: { getState: () => {
      setSpectatorMode: (value: boolean) => void;
      setAiPaused: (value: boolean) => void;
    } } } }).__game.store.getState();
    store.setSpectatorMode(false);
    store.setAiPaused(true);
  });
}

async function setAiPaused(page: Page, value: boolean): Promise<void> {
  await page.evaluate((paused) => {
    const store = (window as unknown as { __game: { store: { getState: () => {
      setAiPaused: (next: boolean) => void;
      setAiSpeedMs: (ms: number) => void;
    } } } }).__game.store.getState();
    store.setAiSpeedMs(0);
    store.setAiPaused(paused);
  }, value);
}

async function cpuProgress(page: Page): Promise<{ tick: number; turn: string }> {
  return page.evaluate(() => {
    const state = (window as unknown as { __game: { getState: () => {
      oppMoveTick: number;
      gameState: { turn: { player: string } };
    } } }).__game.getState();
    return { tick: state.oppMoveTick, turn: state.gameState.turn.player };
  });
}

function combinationState(gs: AnyState): void {
  const self = (gs.players as { self: MutableSide }).self;
  self.case = { cardId: 'D08026', status: '事件編', requiredEvidence: 7, colors: ['青'], declaredUseCount: {} };
  self.file = Array.from({ length: 5 }, () => ({ type: 'card-back', cardId: 'D08017' }));
  self.hand = ['B04012'];
  self.scene = [{
    cardId: 'B03023', uid: 'wakita-e2e', state: 'active', isNamed: false, enterOrder: 1,
    setCards: [], stackedCards: 0,
    keywordOverrides: { granted: [], disabledOriginal: false },
    apOverride: null, lpOverride: null,
    turnEffects: { contactImmune: false, removeOnTurnEnd: false },
    declaredUseCount: {},
  }];
  self.deck = ['B04012'];
  self.remove = [];
  self.evidence = [];
  (gs.players as { opp: MutableSide }).opp.deck = ['D08015'];
  gs.pendingEffects = [];
  gs.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
}

test('BUG-252 actual B03023+B04012 order UI works in desktop and landscape mobile', async ({ page }) => {
  const { errors } = await setupGamePage(page);
  await prime(page);
  await buildGameState(page, combinationState);
  expect(await dispatchAction(page, { type: 'handUseCard', player: 'self', cardId: 'B04012' })).toEqual({ ok: true });

  const panel = page.locator('.effect-stack-panel.open');
  await expect(panel).toBeVisible();
  const entries = panel.locator('.effect-stack-entry');
  await expect(entries).toHaveCount(2);
  await expect(entries.filter({ hasText: '[B03023]' })).toHaveCount(1);
  await expect(entries.filter({ hasText: '[B04012]' })).toHaveCount(1);

  const box = await panel.boundingBox();
  const viewport = page.viewportSize();
  expect(box).not.toBeNull();
  expect(viewport).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewport!.width);
  expect(box!.y + Math.min(box!.height, viewport!.height)).toBeLessThanOrEqual(viewport!.height);

  const firstBefore = (await entries.first().textContent()) ?? '';
  const secondBefore = (await entries.nth(1).textContent()) ?? '';
  const down = entries.first().locator('button[data-testid^="reorder-down-"]');
  expect((await down.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await down.click();
  await expect(entries.first()).toContainText(secondBefore.includes('B03023') ? 'B03023' : 'B04012');
  await panel.locator('.effect-stack-confirm').click();

  const expectedFirst = secondBefore.includes('B03023') ? 'B03023' : 'B04012';
  const surfacedFirst = await page.evaluate(() => (window as unknown as {
    __game: { getState: () => { pendingDeckReveal: { source?: { cardId?: string } } | null } };
  }).__game.getState().pendingDeckReveal?.source?.cardId ?? null);
  expect(surfacedFirst).toBe(expectedFirst);
  expect(firstBefore).not.toContain(expectedFirst);

  const pickedUid = await page.evaluate(() => (window as unknown as {
    __game: { getState: () => { pendingEffectPick: { candidates: { uid: string }[] } | null } };
  }).__game.getState().pendingEffectPick?.candidates[0]?.uid ?? null);
  expect(pickedUid).not.toBeNull();
  expect(await dispatchAction(page, { type: 'effectPickResolve', pickedUid })).toEqual({ ok: true });

  const overlay = page.getByTestId('deck-reveal-overlay');
  await expect(overlay).toBeVisible();
  await expect(overlay.locator('img.deck-reveal-card-art')).toBeVisible();
  await expect(overlay.locator('.deck-reveal-card.is-matched')).toHaveCount(0);
  await expect(overlay.locator('.deck-reveal-match-badge')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('BUG-252 CPU private B04012 look leaks no ID, image, overlay, or log identity', async ({ page }) => {
  const { errors } = await setupGamePage(page);
  await prime(page);
  await buildGameState(page, (gs: AnyState) => {
    const opp = (gs.players as { opp: MutableSide }).opp;
    opp.case = { cardId: 'D08026', status: '事件編', requiredEvidence: 7, colors: ['青'], declaredUseCount: {} };
    opp.file = Array.from({ length: 5 }, () => ({ type: 'card-back', cardId: 'D08017' }));
    opp.hand = ['B04012'];
    opp.scene = [];
    opp.deck = ['D08015'];
    gs.pendingEffects = [];
    gs.turn = { number: 5, player: 'opp', phase: 'main', isFirstPlayerFirstTurn: false };
  });

  expect(await dispatchAction(page, { type: 'handUseCard', player: 'opp', cardId: 'B04012' })).toEqual({ ok: true });
  await expect(page.getByTestId('deck-reveal-overlay')).toHaveCount(0);
  await expect(page.locator('body')).not.toContainText('D08015');
  const privateResult = await page.evaluate(() => {
    const state = (window as unknown as { __game: { getState: () => { gameState: AnyState; pendingDeckReveal: unknown } } }).__game.getState();
    return {
      pending: state.pendingDeckReveal,
      result: state.gameState.log.find((entry: AnyState) => entry.action === 'effect:deckRevealUntil')?.result,
    };
  });
  expect(privateResult.pending).toBeNull();
  expect(privateResult.result).toBe('revealed=1 matched=hidden visibility=private viewer=opp');
  expect(privateResult.result).not.toContain('D08015');
  expect(errors).toEqual([]);
});

test('BUG-252 CPU B01093 publicly reveals the real top card and pauses until the overlay closes', async ({ page }) => {
  const { errors } = await setupGamePage(page);
  await prime(page);
  await buildGameState(page, (gs: AnyState) => {
    const self = (gs.players as { self: MutableSide }).self;
    const opp = (gs.players as { opp: MutableSide }).opp;
    self.deck = ['D08015'];
    self.hand = [];
    self.scene = [];
    opp.case = { cardId: 'D08026', status: '事件編', requiredEvidence: 7, colors: ['黄'], declaredUseCount: {} };
    opp.file = Array.from({ length: 5 }, () => ({ type: 'card-back', cardId: 'D08017' }));
    opp.hand = ['B01093'];
    opp.scene = [];
    opp.deck = ['D08017', 'D08017'];
    gs.pendingEffects = [];
    gs.turn = { number: 5, player: 'opp', phase: 'main', isFirstPlayerFirstTurn: false };
  });

  expect(await dispatchAction(page, { type: 'handUseCard', player: 'opp', cardId: 'B01093' })).toEqual({ ok: true });
  const overlay = page.getByTestId('deck-reveal-overlay');
  await expect(overlay).toBeVisible();
  await expect(overlay.locator('[data-card-id="D08015"] img.deck-reveal-card-art')).toBeVisible();
  const before = await cpuProgress(page);
  await setAiPaused(page, false);
  await page.waitForTimeout(250);
  expect(await cpuProgress(page)).toEqual(before);
  await expect(overlay).toHaveCount(0, { timeout: 6_000 });
  await expect.poll(async () => {
    const after = await cpuProgress(page);
    return after.turn !== before.turn || after.tick > before.tick;
  }, { timeout: 5_000 }).toBe(true);
  expect(errors).toEqual([]);
});

test('BUG-252 CPU B03023 real trigger publicly reveals and pauses CPU progression', async ({ page }) => {
  const { errors } = await setupGamePage(page);
  await prime(page);
  await buildGameState(page, (gs: AnyState) => {
    const self = (gs.players as { self: MutableSide }).self;
    const opp = (gs.players as { opp: MutableSide }).opp;
    self.deck = ['D08015'];
    self.hand = [];
    self.scene = [];
    opp.case = { cardId: 'D08026', status: '事件編', requiredEvidence: 7, colors: ['青'], declaredUseCount: {} };
    opp.file = Array.from({ length: 5 }, () => ({ type: 'card-back', cardId: 'D08017' }));
    opp.hand = ['D08023'];
    opp.scene = [{
      cardId: 'B03023', uid: 'cpu-wakita', state: 'active', isNamed: false, enterOrder: 1,
      setCards: [], stackedCards: 0,
      keywordOverrides: { granted: [], disabledOriginal: false },
      apOverride: null, lpOverride: null,
      turnEffects: { contactImmune: false, removeOnTurnEnd: false },
      declaredUseCount: {},
    }];
    opp.deck = ['D08017', 'D08017'];
    gs.pendingEffects = [];
    gs.turn = { number: 5, player: 'opp', phase: 'main', isFirstPlayerFirstTurn: false };
  });

  expect(await dispatchAction(page, { type: 'handUseCard', player: 'opp', cardId: 'D08023' })).toEqual({ ok: true });
  const overlay = page.getByTestId('deck-reveal-overlay');
  await expect(overlay).toBeVisible();
  await expect(overlay.locator('[data-card-id="D08015"] img.deck-reveal-card-art')).toBeVisible();
  const before = await cpuProgress(page);
  await setAiPaused(page, false);
  await page.waitForTimeout(250);
  expect(await cpuProgress(page)).toEqual(before);
  await expect(overlay).toHaveCount(0, { timeout: 5_000 });
  await expect.poll(async () => {
    const after = await cpuProgress(page);
    return after.turn !== before.turn || after.tick > before.tick;
  }, { timeout: 5_000 }).toBe(true);
  expect(errors).toEqual([]);
});

test('BUG-252 CPU B08074 uses the public 捜査3 route and waits for the human deck order', async ({ page }) => {
  const { errors } = await setupGamePage(page);
  await prime(page);
  await buildGameState(page, (gs: AnyState) => {
    const self = (gs.players as { self: MutableSide }).self;
    const opp = (gs.players as { opp: MutableSide }).opp;
    self.deck = ['D08015', 'D08017', 'D08019'];
    self.hand = [];
    self.scene = [];
    opp.case = { cardId: 'D08026', status: '事件編', requiredEvidence: 7, colors: ['黄'], declaredUseCount: {} };
    opp.file = Array.from({ length: 6 }, () => ({ type: 'card-back', cardId: 'D08017' }));
    opp.hand = ['B08074'];
    opp.scene = [];
    opp.deck = ['D08017', 'D08017'];
    gs.pendingEffects = [];
    gs.turn = { number: 5, player: 'opp', phase: 'main', isFirstPlayerFirstTurn: false };
  });

  expect(await dispatchAction(page, { type: 'handUseCard', player: 'opp', cardId: 'B08074' })).toEqual({ ok: true });
  const reorder = page.getByTestId('deck-reorder-modal');
  await expect(reorder).toBeVisible();
  await expect(reorder.locator('[data-card-id="D08015"] img')).toBeVisible();
  await expect(reorder.locator('[data-card-id="D08017"] img')).toBeVisible();
  await expect(reorder.locator('[data-card-id="D08019"] img')).toBeVisible();
  const audit = await page.evaluate(() => {
    const state = (window as unknown as { __game: { getState: () => {
      pendingDeckReveal: { visibility?: string; viewer?: string } | null;
      gameState: { log: Array<{ action?: string; result?: string }> };
    } } }).__game.getState();
    return {
      pending: state.pendingDeckReveal,
      result: state.gameState.log.find((entry) => entry.action === 'effect:deckRevealUntil')?.result,
    };
  });
  expect(audit.result).toContain('revealed=3');
  expect(audit.result).toContain('visibility=public viewer=all');
  const before = await cpuProgress(page);
  await setAiPaused(page, false);
  await page.waitForTimeout(250);
  expect(await cpuProgress(page)).toEqual(before);
  await page.getByTestId('deck-reorder-confirm-btn').click();
  await expect.poll(async () => {
    const after = await cpuProgress(page);
    return after.turn !== before.turn || after.tick > before.tick;
  }, { timeout: 5_000 }).toBe(true);
  expect(errors).toEqual([]);
});
