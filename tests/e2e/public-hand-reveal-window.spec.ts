import { expect, test } from '@playwright/test';
import { buildGameState, dispatchAction, expectNoConsoleErrors, getGameState, setupGamePage } from './helpers';

test('B03111 public hand reveal remains visible beside its linked picker and resolves the selected duplicate', async ({ page }) => {
  const { errors } = await setupGamePage(page);
  await page.evaluate(() => {
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
    const store = (window as unknown as { __game: { store: { getState: () => { setSpectatorMode: (value: boolean) => void; setAiPaused: (value: boolean) => void } } } }).__game.store.getState();
    store.setSpectatorMode(false);
    store.setAiPaused(true);
  });
  await buildGameState(page, (gs) => {
    const self = gs.players.self as Record<string, unknown>;
    const opp = gs.players.opp as Record<string, unknown>;
    self.case = { cardId: 'D08026', status: 'unresolved', requiredEvidence: 7, colors: ['黒'], declaredUseCount: {} };
    self.partner = { cardId: 'D07001', state: 'active', location: 'partner-area' };
    self.hand = ['B03111'];
    self.file = Array.from({ length: 7 }, () => ({ type: 'card-back', cardId: 'D08017' }));
    self.scene = [];
    opp.hand = ['D08015', 'D08015'];
    opp.scene = [];
    gs.pendingEffects = [];
    gs.turn = { number: 3, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  });

  expect(await dispatchAction(page, { type: 'handUseCard', player: 'self', cardId: 'B03111' })).toEqual({ ok: true });
  const reveal = page.getByTestId('public-hand-reveal-window');
  const picker = page.getByTestId('effect-picker-modal');
  await expect(reveal).toHaveCount(1);
  await expect(reveal).toBeVisible();
  await expect(picker).toBeVisible();
  await expect(picker.getByTestId('public-hand-reveal-window')).toBeVisible();
  await expect(reveal.getByTestId('public-hand-reveal-card-0')).toBeVisible();
  await expect(reveal.getByTestId('public-hand-reveal-card-1')).toBeVisible();

  const firstDetail = reveal.getByTestId('public-hand-reveal-detail-0');
  const secondDetail = reveal.getByTestId('public-hand-reveal-detail-1');
  await expect(firstDetail).toHaveAccessibleName(/occurrence 1/);
  await expect(secondDetail).toHaveAccessibleName(/occurrence 2/);
  await expect(firstDetail).toBeFocused();

  // The reveal stays usable above its linked effect picker. Card detail is
  // still the highest-priority layer, so it can be opened and closed before
  // the pending pick is resolved.
  await secondDetail.click();
  await expect(page.locator('.card-expand-modal-backdrop')).toBeVisible();
  await page.locator('.card-expand-close').click();
  await expect(page.locator('.card-expand-modal-backdrop')).toBeHidden();
  await expect(secondDetail).toBeFocused();

  const candidates = await page.evaluate(() => (window as unknown as { __game: { getState: () => {
    pendingEffectPick: { candidates: Array<{ uid: string; cardId: string }> } | null;
  } } }).__game.getState().pendingEffectPick?.candidates ?? []);
  expect(candidates.map((candidate) => candidate.cardId)).toEqual(['D08015', 'D08015']);
  await picker.getByTestId(`effect-pick-cand-${candidates[1]!.uid}`).click();

  await expect.poll(async () => {
    const state = await getGameState(page);
    return {
      hand: state.players.opp.hand,
      pickedDuplicateWasRemoved: state.players.opp.remove.filter((cardId) => cardId === 'D08015').length,
    };
  }).toEqual({ hand: ['D08015'], pickedDuplicateWasRemoved: 1 });
  await expect(reveal).toBeHidden();
  expectNoConsoleErrors(errors);
});

test('B10024 keeps its public reveal inside the scene-target picker through keyboard detail review', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const { errors } = await setupGamePage(page);
  await page.evaluate(() => {
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
    const store = (window as unknown as { __game: { store: { getState: () => {
      setSpectatorMode: (value: boolean) => void;
      setAiPaused: (value: boolean) => void;
    } } } }).__game.store.getState();
    store.setSpectatorMode(false);
    store.setAiPaused(true);
  });
  await buildGameState(page, (gs) => {
    const self = gs.players.self as Record<string, unknown>;
    const opp = gs.players.opp as Record<string, unknown>;
    self.case = { cardId: 'D08026', status: 'unresolved', requiredEvidence: 7, colors: ['緑'], declaredUseCount: {} };
    self.partner = { cardId: 'D02001', state: 'active', location: 'partner-area' };
    self.hand = ['B10024', 'B10024'];
    self.file = Array.from({ length: 8 }, () => ({ type: 'card-back', cardId: 'D08017' }));
    self.scene = [];
    opp.hand = [];
    opp.scene = [];
    gs.pendingEffects = [];
    gs.turn = { number: 3, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  });

  expect(await dispatchAction(page, { type: 'handUseCard', player: 'self', cardId: 'B10024' })).toEqual({ ok: true });
  const firstDecision = await page.evaluate(() => (window as unknown as { __game: { getState: () => {
    pendingEffectPick: { atomVerb: string; candidates: Array<{ uid: string; cardId: string }> } | null;
  } } }).__game.getState().pendingEffectPick);
  expect(firstDecision?.atomVerb).toBe('handReveal');
  expect(firstDecision?.candidates.map((candidate) => candidate.cardId)).toEqual(['B10024']);
  await page.getByTestId(`effect-pick-cand-${firstDecision!.candidates[0]!.uid}`).click();

  const picker = page.getByTestId('effect-picker-modal');
  const reveal = page.getByTestId('public-hand-reveal-window');
  await expect(picker).toBeVisible();
  await expect(reveal).toHaveCount(1);
  await expect(picker.getByTestId('public-hand-reveal-window')).toBeVisible();
  await expect(reveal.getByTestId('public-hand-reveal-card-0')).toBeVisible();

  const detail = reveal.getByTestId('public-hand-reveal-detail-0');
  await expect(detail).toBeFocused();
  const detailBox = await detail.boundingBox();
  expect(detailBox?.width ?? 0).toBeGreaterThanOrEqual(44);
  expect(detailBox?.height ?? 0).toBeGreaterThanOrEqual(44);
  await detail.click();
  await expect(page.locator('.card-expand-modal-backdrop')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.card-expand-modal-backdrop')).toBeHidden();
  await expect(detail).toBeFocused();

  const dialogButtons = picker.locator('button:visible');
  const lastDialogButton = dialogButtons.nth((await dialogButtons.count()) - 1);
  await lastDialogButton.focus();
  await page.keyboard.press('Tab');
  await expect(detail).toBeFocused();

  const targetDecision = await page.evaluate(() => (window as unknown as { __game: { getState: () => {
    pendingEffectPick: { atomVerb: string; candidates: Array<{ uid: string; cardId: string }> } | null;
  } } }).__game.getState().pendingEffectPick);
  expect(targetDecision?.atomVerb).toBe('sceneRemove');
  expect(targetDecision?.candidates.map((candidate) => candidate.cardId)).toEqual(['B10024']);
  await picker.getByTestId(`effect-pick-cand-${targetDecision!.candidates[0]!.uid}`).click();

  await expect(reveal).toBeHidden();
  await expect.poll(async () => {
    const state = await getGameState(page);
    return {
      hand: state.players.self.hand,
      scene: state.players.self.scene.map((card) => card.cardId),
      removedB10024: state.players.self.remove.filter((cardId) => cardId === 'B10024').length,
    };
  }).toEqual({ hand: ['B10024'], scene: [], removedB10024: 1 });
  expectNoConsoleErrors(errors);
});

test('B09061 presents the three selected FBI cards once, then hides them after drawing', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const { errors } = await setupGamePage(page);
  await page.evaluate(() => {
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
    const store = (window as unknown as { __game: { store: { getState: () => {
      setSpectatorMode: (value: boolean) => void;
      setAiPaused: (value: boolean) => void;
    } } } }).__game.store.getState();
    store.setSpectatorMode(false);
    store.setAiPaused(true);
  });
  await buildGameState(page, (gs) => {
    const self = gs.players.self as Record<string, unknown>;
    const opp = gs.players.opp as Record<string, unknown>;
    self.case = { cardId: 'D08026', status: 'unresolved', requiredEvidence: 7, colors: ['赤'], declaredUseCount: {} };
    self.partner = { cardId: 'D07001', state: 'active', location: 'partner-area' };
    self.hand = ['B09061', 'B09061', 'B09061', 'B09061'];
    self.deck = ['D08015', 'D08003'];
    self.file = Array.from({ length: 4 }, () => ({ type: 'card-back', cardId: 'D08017' }));
    self.scene = [];
    opp.hand = [];
    opp.scene = [];
    gs.pendingEffects = [];
    gs.turn = { number: 3, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  });

  expect(await dispatchAction(page, { type: 'handUseCard', player: 'self', cardId: 'B09061' })).toEqual({ ok: true });
  await expect(page.getByTestId('optional-picker-modal')).toBeVisible();
  await page.getByTestId('opt-run-yes').click();

  const candidates = await page.evaluate(() => (window as unknown as { __game: { getState: () => {
    pendingEffectPick: { candidates: Array<{ uid: string; cardId: string }> } | null;
  } } }).__game.getState().pendingEffectPick?.candidates ?? []);
  expect(candidates).toHaveLength(3);
  expect(candidates.map((candidate) => candidate.cardId)).toEqual(['B09061', 'B09061', 'B09061']);
  for (const candidate of candidates) {
    await page.getByTestId(`effect-pick-cand-${candidate.uid}`).click();
  }
  await page.getByTestId('effect-picker-confirm').click();

  const reveal = page.getByTestId('public-hand-reveal-window');
  await expect(reveal).toBeVisible();
  await expect(reveal.locator('[data-testid^="public-hand-reveal-card-"]')).toHaveCount(3);
  await expect.poll(async () => {
    const state = await getGameState(page);
    return {
      hand: state.players.self.hand,
      deck: state.players.self.deck,
    };
  }).toEqual({
    hand: ['B09061', 'B09061', 'B09061', 'D08015'],
    deck: ['D08003'],
  });
  await page.waitForTimeout(1_800);
  await expect(reveal).toBeVisible();
  const close = page.getByTestId('public-hand-reveal-close');
  await close.focus();
  await expect(close).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(reveal).toBeHidden();
  expectNoConsoleErrors(errors);
});
