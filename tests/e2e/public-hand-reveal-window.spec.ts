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
  await expect(reveal).toBeVisible();
  await expect(picker).toBeVisible();
  await expect(reveal.getByTestId('public-hand-reveal-card-0')).toBeVisible();
  await expect(reveal.getByTestId('public-hand-reveal-card-1')).toBeVisible();

  const firstDetail = reveal.getByTestId('public-hand-reveal-detail-0');
  const secondDetail = reveal.getByTestId('public-hand-reveal-detail-1');
  await expect(firstDetail).toHaveAccessibleName(/occurrence 1/);
  await expect(secondDetail).toHaveAccessibleName(/occurrence 2/);

  // The reveal stays usable above its linked effect picker. Card detail is
  // still the highest-priority layer, so it can be opened and closed before
  // the pending pick is resolved.
  await secondDetail.click();
  await expect(page.locator('.card-expand-modal-backdrop')).toBeVisible();
  await page.locator('.card-expand-close').click();
  await expect(page.locator('.card-expand-modal-backdrop')).toBeHidden();

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
