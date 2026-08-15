import { expect, test, type Page } from '@playwright/test';
import { buildGameState, dispatchAction, getGameState, setupGamePage, waitForPhase } from './helpers';

type AnyState = Record<string, unknown>;
type MutableSide = Record<string, unknown>;

async function prime(page: Page): Promise<void> {
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

async function finishContactRemoval(page: Page): Promise<void> {
  expect(await dispatchAction(page, { type: 'actionDeclareChar', byUid: 'attacker', targetUid: 'source' })).toEqual({ ok: true });
  const actionId = await page.evaluate(() => (window as unknown as {
    __game: { getState: () => { activeActionId: string | null } };
  }).__game.getState().activeActionId);
  expect(actionId).not.toBeNull();
  const guard = page.getByTestId('guard-picker-modal');
  await expect(guard).toBeVisible();
  await guard.getByTestId('guard-picker-skip').click();
  await waitForPhase(page, 'action-1');
  expect(await dispatchAction(page, { type: 'actionContact', actionId, player: 'self', choice: { kind: 'pass' } })).toEqual({ ok: true });
  expect(await dispatchAction(page, { type: 'actionAdvance', actionId })).toEqual({ ok: true });
  await waitForPhase(page, 'action-2');
  expect(await dispatchAction(page, { type: 'actionContact', actionId, player: 'opp', choice: { kind: 'pass' } })).toEqual({ ok: true });
  expect(await dispatchAction(page, { type: 'actionAdvance', actionId })).toEqual({ ok: true });
  await waitForPhase(page, 'judge');
  expect(await dispatchAction(page, { type: 'actionJudge', actionId })).toEqual({ ok: true });
}

test('prepared B03079 decision keeps top three private and publicly presents only the selected card', async ({ page }) => {
  const { errors } = await setupGamePage(page);
  await prime(page);
  await buildGameState(page, (state: AnyState) => {
    const sceneChar = (cardId: string, uid: string, charState: 'active' | 'sleep') => ({
      cardId,
      uid,
      state: charState,
      isNamed: false,
      enterOrder: 1,
      setCards: [],
      stackedCards: 0,
      keywordOverrides: { granted: [], disabledOriginal: false },
      apOverride: null,
      lpOverride: null,
      turnEffects: { contactImmune: false, removeOnTurnEnd: false },
      declaredUseCount: {},
    });
    const self = (state.players as { self: MutableSide }).self;
    const opp = (state.players as { opp: MutableSide }).opp;
    self.scene = [
      sceneChar('B03079', 'source', 'sleep'),
      sceneChar('D08017', 'guard', 'active'),
    ];
    self.deck = ['D08017', 'B03079', 'D08015', 'D08003'];
    self.hand = ['D08003'];
    self.remove = [];
    opp.scene = [sceneChar('D11003', 'attacker', 'active')];
    state.pendingEffects = [];
    state.turn = { number: 6, player: 'opp', phase: 'main', isFirstPlayerFirstTurn: false };
  });

  await finishContactRemoval(page);

  await expect(page.getByTestId('public-hand-reveal-window')).toHaveCount(0);
  const decision = await page.evaluate(() => {
    const store = (window as unknown as { __game: { getState: () => {
      pendingDeckReveal: Record<string, unknown> | null;
      pendingEffectPick: { candidates: Array<{ uid: string; cardId: string }> } | null;
    } } }).__game.getState();
    return { reveal: store.pendingDeckReveal, pick: store.pendingEffectPick };
  });
  expect(decision.reveal).toMatchObject({
    player: 'self',
    visibility: 'private',
    viewer: 'self',
    revealed: ['D08017', 'B03079', 'D08015'],
    awaitingPick: true,
  });
  const pendingPick = decision.pick;
  const selected = pendingPick?.candidates.find((candidate) => candidate.cardId === 'B03079');
  expect(selected).toBeTruthy();

  const privateLook = page.getByRole('dialog', { name: /自分の公開されたカード/ });
  await expect(privateLook).toBeVisible();
  await privateLook.getByRole('button', { name: 'レイチェル・浅香 を選択' }).click();

  const publicCard = page.getByTestId('public-hand-reveal-window');
  await expect(publicCard).toBeVisible();
  await expect(publicCard).toHaveAttribute('data-origin', 'deck-selected-card');
  await expect(publicCard.getByTestId('public-hand-reveal-owner')).toHaveText('公開して手札に加えたカード');
  await expect(publicCard.locator('.public-hand-reveal-card')).toHaveCount(1);
  await expect(publicCard.locator('.public-hand-reveal-name')).toHaveText('レイチェル・浅香');
  await expect(publicCard.getByTestId('public-hand-reveal-detail-0'))
    .toHaveAccessibleName('「レイチェル・浅香」の詳細（1枚目）');
  await expect(publicCard.getByTestId('public-hand-reveal-close')).toBeFocused();
  const published = await page.evaluate(() => (window as unknown as {
    __game: { getState: () => { pendingPublicHandReveal: Record<string, unknown> | null } };
  }).__game.getState().pendingPublicHandReveal);
  expect(published).toMatchObject({
    cardIds: ['B03079'],
    origin: 'deck-selected-card',
    lifetime: 'presentation',
  });
  expect(published).not.toHaveProperty('handSnapshot');
  expect(JSON.stringify(published)).not.toContain('D08017');
  expect(JSON.stringify(published)).not.toContain('D08015');
  expect(JSON.stringify(published)).not.toContain('D08003');
  await expect(page.getByTestId('deck-reorder-modal')).toHaveCount(0);

  await publicCard.getByTestId('public-hand-reveal-close').click();
  await expect(publicCard).toHaveCount(0);
  const reorder = page.getByTestId('deck-reorder-modal');
  await expect(reorder).toBeVisible();
  expect(await reorder.evaluate((dialog) => dialog.contains(document.activeElement))).toBe(true);
  await reorder.getByTestId('deck-reorder-down-0').click();
  await expect(reorder.getByTestId('deck-reorder-row-0')).toContainText('小嶋元太');
  await page.keyboard.press('Escape');
  await expect(reorder).toHaveCount(0);
  await expect(page.getByTestId('actions-panel-focus-anchor')).toBeFocused();
  expect((await getGameState(page)).players.self.deck).toEqual(['D08003', 'D08017', 'D08015']);
  expect(errors).toEqual([]);
});

for (const family of [
  { sourceCardId: 'D01012', matchCardId: 'D08017', wrongLevelId: 'D08009', wrongColorId: 'D02009' },
  { sourceCardId: 'D05007', matchCardId: 'D11013', wrongLevelId: 'D08009', wrongColorId: 'D02009' },
] as const) {
  test(`prepared ${family.sourceCardId} deck choice opens a full-scene switch before resolving`, async ({ page }) => {
    const { errors } = await setupGamePage(page);
    await prime(page);
    await buildGameState(page, (state: AnyState, cardFamily) => {
      const sceneChar = (cardId: string, uid: string, charState: 'active' | 'sleep') => ({
        cardId, uid, state: charState, isNamed: false, enterOrder: 1,
        setCards: [], stackedCards: 0, keywordOverrides: { granted: [], disabledOriginal: false },
        apOverride: null, lpOverride: null, turnEffects: { contactImmune: false, removeOnTurnEnd: false },
        declaredUseCount: {},
      });
      const self = (state.players as { self: MutableSide }).self;
      const opp = (state.players as { opp: MutableSide }).opp;
      self.scene = [
        sceneChar(cardFamily.sourceCardId, 'source', 'sleep'),
        sceneChar('D08017', 'guard', 'active'),
      ];
      self.deck = [cardFamily.matchCardId, cardFamily.wrongLevelId, cardFamily.wrongColorId, 'D08003'];
      self.remove = [];
      opp.scene = [sceneChar('D11003', 'attacker', 'active')];
      state.pendingEffects = [];
      state.turn = { number: 6, player: 'opp', phase: 'main', isFirstPlayerFirstTurn: false };
    }, family);

    await finishContactRemoval(page);
    await page.evaluate(() => {
      const game = (window as unknown as { __game: { store: { getState: () => {
        gameState: AnyState;
        setGameState: (state: AnyState, options?: { preserveRuntime?: boolean }) => boolean;
      } } } }).__game;
      const store = game.store.getState();
      const filled = structuredClone(store.gameState);
      const self = (filled.players as { self: MutableSide }).self;
      self.scene = Array.from({ length: 5 }, (_, index) => ({
        cardId: 'D08017', uid: `full-scene-${index}`, state: 'active', isNamed: false, enterOrder: index + 1,
        setCards: [], stackedCards: 0, keywordOverrides: { granted: [], disabledOriginal: false },
        apOverride: null, lpOverride: null, turnEffects: { contactImmune: false, removeOnTurnEnd: false },
        declaredUseCount: {},
      }));
      if (!store.setGameState(filled, { preserveRuntime: true })) throw new Error('failed to preserve prepared deck choice');
    });

    const candidateUid = await page.evaluate((cardId) => {
      const pick = (window as unknown as { __game: { getState: () => {
        pendingEffectPick: { candidates: Array<{ uid: string; cardId: string }> } | null;
      } } }).__game.getState().pendingEffectPick;
      return pick?.candidates.find((candidate) => candidate.cardId === cardId)?.uid ?? null;
    }, family.matchCardId);
    expect(candidateUid).not.toBeNull();
    await page.getByTestId(`card-list-pick-${candidateUid}`).click();
    await expect(page.getByTestId('switch-victim-overlay')).toBeVisible();
    await page.getByTestId('scene-card-pick-full-scene-2').click();
    await expect(page.getByTestId('switch-victim-overlay')).toBeHidden();

    const reorder = page.getByTestId('deck-reorder-modal');
    await expect(reorder).toBeVisible({ timeout: 10_000 });
    await page.keyboard.press('Escape');
    await expect(reorder).toHaveCount(0);
    const final = await getGameState(page);
    expect(final.players.self.scene).toHaveLength(5);
    expect(final.players.self.scene).toEqual(expect.arrayContaining([
      expect.objectContaining({ cardId: family.matchCardId, state: 'sleep' }),
    ]));
    expect(final.players.self.scene.some((character: { uid?: string }) => character.uid === 'full-scene-2')).toBe(false);
    expect(final.players.self.remove).toEqual(expect.arrayContaining([family.sourceCardId, 'D08017']));
    expect(final.players.self.deck).toEqual(['D08003', family.wrongLevelId, family.wrongColorId]);
    expect(errors).toEqual([]);
  });
}
