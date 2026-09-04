import { test, expect, type Page } from '@playwright/test';
import { buildGameState, expectNoConsoleErrors, getGameState, setupGamePage, type GameStateLike } from './helpers';

async function setHumanSelf(page: Page): Promise<void> {
  await page.evaluate(() => {
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
  });
}

async function declaredUseCount(page: Page, uid: string, abilityId: string): Promise<number> {
  return page.evaluate(([sourceUid, sourceAbilityId]) => {
    const game = (window as unknown as {
      __game: {
        getState: () => { gameState: unknown };
        read: { char: { declaredUseCount: (state: unknown, uid: string, abilityId: string) => number } };
      };
    }).__game;
    return game.read.char.declaredUseCount(game.getState().gameState, sourceUid, sourceAbilityId);
  }, [uid, abilityId] as const);
}

function applyB02023Fixture(state: GameStateLike): void {
  const makeChar = (cardId: string, uid: string, setCards: unknown[] = []) => ({
    cardId, uid, state: 'active', isNamed: false, enterOrder: 1, setCards, stackedCards: 0,
    keywordOverrides: { granted: [], disabledOriginal: false }, apOverride: null, lpOverride: null,
    turnEffects: { contactImmune: false, removeOnTurnEnd: false }, declaredUseCount: {},
  });
  const game = state as unknown as {
    players: { self: Record<string, unknown>; opp: Record<string, unknown> };
    pendingEffects: unknown[];
    turn: { number: number; player: string; phase: string; isFirstPlayerFirstTurn: boolean };
  };
  game.players.self.partner = { cardId: 'D08001', state: 'active', location: 'partner-area' };
  game.players.self.scene = [
    makeChar('B02023', 'kazuha'),
    makeChar('D08013', 'host', [
      { cardId: 'D08003', faceUp: false, instanceId: 'set:host:first' },
      { cardId: 'D08007', faceUp: false, instanceId: 'set:host:second' },
    ]),
    makeChar('D08013', 'victim'),
  ];
  game.players.self.hand = [];
  game.players.self.deck = [];
  game.players.self.remove = [];
  game.players.opp.scene = [makeChar('D08013', 'opp-decoy')];
  game.players.opp.hand = [];
  game.pendingEffects = [];
  game.turn = { number: 3, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
}

function applySameNameHostFixture(state: GameStateLike): void {
  const makeChar = (cardId: string, uid: string, setCards: unknown[] = []) => ({
    cardId, uid, state: 'active', isNamed: false, enterOrder: 1, setCards, stackedCards: 0,
    keywordOverrides: { granted: [], disabledOriginal: false }, apOverride: null, lpOverride: null,
    turnEffects: { contactImmune: false, removeOnTurnEnd: false }, declaredUseCount: {},
  });
  const game = state as unknown as { players: { self: Record<string, unknown>; opp: Record<string, unknown> }; pendingEffects: unknown[]; turn: { number: number; player: string; phase: string; isFirstPlayerFirstTurn: boolean } };
  game.players.self.partner = { cardId: 'D08001', state: 'active', location: 'partner-area' };
  game.players.self.scene = [
    makeChar('B02023', 'kazuha'),
    makeChar('D08013', 'same-name-first', [{ cardId: 'D08003', faceUp: false, instanceId: 'set:same:first' }]),
    makeChar('D08013', 'same-name-second', [{ cardId: 'D08007', faceUp: false, instanceId: 'set:same:second' }]),
    makeChar('D08013', 'victim'),
  ];
  game.players.self.hand = []; game.players.self.deck = []; game.players.self.remove = [];
  game.players.opp.scene = []; game.players.opp.hand = []; game.pendingEffects = [];
  game.turn = { number: 3, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
}

function applyB08033Fixture(state: GameStateLike): void {
  const makeChar = (cardId: string, uid: string, setCards: unknown[] = []) => ({
    cardId, uid, state: 'active', isNamed: false, enterOrder: 1, setCards, stackedCards: 0,
    keywordOverrides: { granted: [], disabledOriginal: false }, apOverride: null, lpOverride: null,
    turnEffects: { contactImmune: false, removeOnTurnEnd: false }, declaredUseCount: {},
  });
  const game = state as unknown as { players: { self: Record<string, unknown>; opp: Record<string, unknown> }; pendingEffects: unknown[]; turn: { number: number; player: string; phase: string; isFirstPlayerFirstTurn: boolean } };
  game.players.self.partner = { cardId: 'D06002', state: 'active', location: 'partner-area' };
  game.players.self.scene = [
    makeChar('B08033', 'source'),
    makeChar('D08013', 'host', [
      { cardId: 'D08003', faceUp: false, instanceId: 'set:n2:first' },
      { cardId: 'D08007', faceUp: false, instanceId: 'set:n2:second' },
    ]),
  ];
  game.players.self.hand = []; game.players.self.deck = []; game.players.self.remove = [];
  game.players.opp.scene = []; game.players.opp.hand = []; game.pendingEffects = [];
  game.turn = { number: 3, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
}

function applyB07048AlternativeFixture(state: GameStateLike, unavailable = false): void {
  const makeChar = (cardId: string, uid: string, setCards: unknown[] = []) => ({
    cardId, uid, state: 'active', isNamed: false, enterOrder: 1, setCards, stackedCards: 0,
    keywordOverrides: { granted: [], disabledOriginal: false }, apOverride: null, lpOverride: null,
    turnEffects: { contactImmune: false, removeOnTurnEnd: false }, declaredUseCount: {},
  });
  const game = state as unknown as { players: { self: Record<string, unknown>; opp: Record<string, unknown> }; pendingEffects: unknown[]; turn: { number: number; player: string; phase: string; isFirstPlayerFirstTurn: boolean } };
  game.players.self.partner = { cardId: 'D06002', state: 'active', location: 'partner-area' };
  game.players.self.scene = [
    makeChar('B07048', 'source', [
      { cardId: 'D08003', faceUp: false, instanceId: 'set:stale:first' },
      { cardId: 'D08007', faceUp: false, instanceId: 'set:stale:second' },
    ]),
    makeChar('B05033', 'provider'),
    makeChar('B05033', 'provider-two'),
  ];
  game.players.self.hand = ['D08003']; game.players.self.deck = ['D08007']; game.players.self.remove = [];
  game.players.opp.scene = []; game.players.opp.hand = []; game.pendingEffects = [];
  game.turn = { number: 3, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  if (unavailable) {
    const scene = game.players.self.scene as Array<{ uid: string; setCards: unknown[] }>;
    scene.find((entry) => entry.uid === 'source')!.setCards.pop();
  }
}

async function openB02023CostPicker(page: Page): Promise<void> {
  await page.locator('[data-action-id="declared-ability"]').click();
  await page.locator('[data-uid="kazuha"]').click();
  await page.locator('.confirm-ok').click();
  await expect(page.getByTestId('set-card-choice-modal')).toBeVisible();
}

test('BUG-248: B02023 cost picker cancels, reopens, and pays the selected physical set card', async ({ page }, testInfo) => {
  if (testInfo.project.name === 'chromium') await page.setViewportSize({ width: 1280, height: 720 });
  const { errors } = await setupGamePage(page);
  await setHumanSelf(page);
  await buildGameState(page, applyB02023Fixture);

  await openB02023CostPicker(page);
  const modal = page.getByTestId('set-card-choice-modal');
  await expect(modal.locator('[data-testid^="set-card-choice-"]')).toHaveCount(2);
  await expect(page.getByTestId('set-card-choice-1')).toHaveAttribute('data-instance-id', 'set:host:first');
  await expect(page.getByTestId('set-card-choice-2')).toHaveAttribute('data-instance-id', 'set:host:second');
  await expect(page.getByTestId('set-card-cost-confirm')).toBeDisabled();

  await page.getByTestId('set-card-cost-cancel').click();
  await expect(modal).toBeHidden();
  const cancelled = await getGameState(page);
  const cancelledSelf = cancelled.players.self as unknown as {
    remove: string[];
    scene: { uid: string; state: string; setCards: { instanceId: string }[] }[];
  };
  expect(cancelledSelf.remove).toEqual([]);
  expect(cancelledSelf.scene.find((char) => char.uid === 'kazuha')!.state).toBe('active');
  expect(cancelledSelf.scene.find((char) => char.uid === 'host')!.setCards.map((entry) => entry.instanceId))
    .toEqual(['set:host:first', 'set:host:second']);

  await openB02023CostPicker(page);
  await page.getByTestId('set-card-choice-2').click();
  await expect(page.getByTestId('set-card-cost-confirm')).toBeEnabled();
  await page.getByTestId('set-card-cost-confirm').click();
  await expect(modal).toBeHidden();

  await page.locator('[data-uid="victim"]').click();
  await page.waitForFunction(() => {
    const game = (window as unknown as {
      __game: { getState: () => { gameState: { players: { self: { remove: string[]; scene: Array<{ uid: string; state: string; setCards: Array<{ instanceId: string }> }> } } } } };
    }).__game.getState().gameState;
    const host = game.players.self.scene.find((char) => char.uid === 'host');
    const victim = game.players.self.scene.find((char) => char.uid === 'victim');
    return host?.setCards.length === 1 && host.setCards[0]?.instanceId === 'set:host:first'
      && victim?.state === 'sleep' && game.players.self.remove.includes('D08007');
  });

  const after = await getGameState(page);
  const self = after.players.self as unknown as {
    remove: string[];
    scene: { uid: string; state: string; setCards: { instanceId: string }[]; declaredUseCount: Record<string, number> }[];
  };
  expect(self.remove).toContain('D08007');
  expect(self.scene.find((char) => char.uid === 'host')!.setCards.map((entry) => entry.instanceId)).toEqual(['set:host:first']);
  expect(await declaredUseCount(page, 'kazuha', 'a2')).toBe(1);
  expectNoConsoleErrors(errors);
});

test('BUG-248: same-name hosts remain distinguishable and the chosen physical card alone is paid', async ({ page }, testInfo) => {
  if (testInfo.project.name === 'chromium') await page.setViewportSize({ width: 1280, height: 720 });
  const { errors } = await setupGamePage(page);
  await setHumanSelf(page);
  await buildGameState(page, applySameNameHostFixture);
  await openB02023CostPicker(page);
  const modal = page.getByTestId('set-card-choice-modal');
  await expect(modal.locator('[data-instance-id="set:same:first"][aria-label*="現場2"]')).toBeVisible();
  await expect(modal.locator('[data-instance-id="set:same:second"][aria-label*="現場3"]')).toBeVisible();
  await expect(modal).not.toContainText('D08003');
  await expect(modal).not.toContainText('D08007');
  await page.locator('[data-instance-id="set:same:second"]').click();
  await page.getByTestId('set-card-cost-confirm').click();
  await page.locator('[data-uid="victim"]').click();
  await page.waitForFunction(() => {
    const game = (window as unknown as { __game: { getState: () => { gameState: { players: { self: { remove: string[]; scene: Array<{ uid: string; setCards: Array<{ instanceId: string }> }> } } } } } }).__game.getState().gameState;
    return game.players.self.remove.includes('D08007')
      && game.players.self.scene.find((char) => char.uid === 'same-name-first')?.setCards.length === 1
      && game.players.self.scene.find((char) => char.uid === 'same-name-second')?.setCards.length === 0;
  });
  expectNoConsoleErrors(errors);
});

test('BUG-248: n=2 cost requires two selections and pays both exact cards for B08033', async ({ page }, testInfo) => {
  if (testInfo.project.name === 'chromium') await page.setViewportSize({ width: 1280, height: 720 });
  const { errors } = await setupGamePage(page);
  await setHumanSelf(page);
  await buildGameState(page, applyB08033Fixture);
  await page.locator('[data-action-id="declared-ability"]').click();
  await page.locator('[data-uid="source"]').click();
  await page.locator('.confirm-ok').click();
  await expect(page.getByTestId('set-card-choice-modal')).toBeVisible();
  await expect(page.getByTestId('set-card-cost-confirm')).toBeDisabled();
  await page.getByTestId('set-card-choice-1').click();
  await expect(page.getByTestId('set-card-cost-confirm')).toBeDisabled();
  await page.getByTestId('set-card-choice-2').click();
  await expect(page.getByTestId('set-card-cost-confirm')).toBeEnabled();
  await page.getByTestId('set-card-cost-confirm').click();
  await expect(page.getByTestId('set-card-choice-modal')).toBeHidden();
  const game = await getGameState(page);
  const self = game.players.self as unknown as { remove: string[]; scene: Array<{ uid: string; declaredUseCount: Record<string, number> }> };
  expect(self.remove).toEqual(expect.arrayContaining(['D08003', 'D08007']));
  expect(await declaredUseCount(page, 'source', 'a2')).toBe(1);
  expectNoConsoleErrors(errors);
});

test('BUG-248 defensive harness: a synthetic stale printed selection never falls back to B05033', async ({ page }, testInfo) => {
  if (testInfo.project.name === 'chromium') await page.setViewportSize({ width: 1280, height: 720 });
  const { errors } = await setupGamePage(page);
  await setHumanSelf(page);
  await buildGameState(page, applyB07048AlternativeFixture);
  await page.locator('[data-action-id="declared-ability"]').click();
  await page.locator('[data-uid="source"]').click();
  await page.locator('.confirm-ok').click();
  await page.getByTestId('cp-opt-0').click();
  await expect(page.getByTestId('set-card-choice-modal')).toBeVisible();
  await page.evaluate(() => {
    const store = (window as unknown as {
      __game: {
        store: { getState: () => { dispatch: (mutator: (state: unknown) => unknown) => boolean } };
      };
    }).__game.store.getState();
    const committed = store.dispatch((current) => {
      const next = structuredClone(current) as {
        players: { self: { scene: Array<{ uid: string; setCards: unknown[] }> } };
      };
      next.players.self.scene.find((entry) => entry.uid === 'source')!.setCards.pop();
      return next;
    });
    if (!committed) throw new Error('stale set-card fixture commit rejected');
  });
  await page.getByTestId('set-card-choice-1').click();
  await page.getByTestId('set-card-choice-2').click();
  await page.getByTestId('set-card-cost-confirm').click();
  const rejected = await getGameState(page);
  const rejectedSelf = rejected.players.self as unknown as { remove: string[]; scene: Array<{ uid: string; declaredUseCount: Record<string, number> }> };
  expect(rejectedSelf.remove).toEqual([]);
  expect(rejectedSelf.scene.some((entry) => entry.uid === 'provider')).toBe(true);
  expect(await declaredUseCount(page, 'source', 'a2')).toBe(0);

  await buildGameState(page, applyB07048AlternativeFixture);
  await page.locator('[data-action-id="declared-ability"]').click();
  await page.locator('[data-uid="source"]').click();
  await page.locator('.confirm-ok').click();
  await page.getByTestId('cp-opt-1').click();
  const alternative = await getGameState(page);
  const alternativeSelf = alternative.players.self as unknown as { scene: Array<{ uid: string; declaredUseCount: Record<string, number> }> };
  expect(alternativeSelf.scene.some((entry) => entry.uid === 'provider')).toBe(false);
  expect(await declaredUseCount(page, 'source', 'a2')).toBe(1);

  expectNoConsoleErrors(errors);
});

test('BUG-248: B07048 exposes explicit B05033 alternative when its printed n=2 cost is already unavailable', async ({ page }, testInfo) => {
  if (testInfo.project.name === 'chromium') await page.setViewportSize({ width: 1280, height: 720 });
  const { errors } = await setupGamePage(page);
  await setHumanSelf(page);
  await buildGameState(page, applyB07048AlternativeFixture, true);
  await page.locator('[data-action-id="declared-ability"]').click();
  await page.locator('[data-uid="source"]').click();
  await page.locator('.confirm-ok').click();
  await expect(page.getByTestId('choice-picker-modal')).toBeVisible();
  await expect(page.getByTestId('cp-opt-0')).toHaveText(/現場2/);
  await expect(page.getByTestId('cp-opt-1')).toHaveText(/現場3/);
  await page.getByTestId('cp-opt-1').click();
  const after = await getGameState(page);
  const self = after.players.self as unknown as { scene: Array<{ uid: string; declaredUseCount: Record<string, number> }> };
  expect(self.scene.some((entry) => entry.uid === 'provider')).toBe(true);
  expect(self.scene.some((entry) => entry.uid === 'provider-two')).toBe(false);
  expect(await declaredUseCount(page, 'source', 'a2')).toBe(1);
  expectNoConsoleErrors(errors);
});
