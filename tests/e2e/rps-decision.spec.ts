import { test, expect } from '@playwright/test';
import { setupGamePage, buildGameState, dispatchAction } from './helpers';

test('B07011 surfaces the dedicated RPS modal and accepts a hand choice', async ({ page }) => {
  const { errors } = await setupGamePage(page);
  await page.evaluate(() => {
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
    Math.random = () => 0.4;
    const w = window as unknown as { __game: { store: { getState: () => { setSpectatorMode: (v: boolean) => void } } } };
    w.__game.store.getState().setSpectatorMode(false);
  });
  await buildGameState(page, (gs) => {
    const self = gs.players.self as unknown as Record<string, unknown>;
    self.partner = { cardId: 'D08001', state: 'active', location: 'partner-area' };
    self.case = { cardId: 'D08026', status: '\u4e8b\u4ef6\u7de8', requiredEvidence: 7, colors: ['\u9752'], declaredUseCount: {} };
    self.hand = ['B07011']; self.deck = ['D08005']; self.scene = []; self.evidence = []; self.remove = [];
    self.file = [{ type: 'card-back', cardId: 'A' }, { type: 'card-back', cardId: 'B' }, { type: 'card-back', cardId: 'C' }];
    (gs as unknown as Record<string, unknown>).pendingEffects = [];
    (gs as unknown as Record<string, unknown>).turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  });
  await dispatchAction(page, { type: 'handUseCard', player: 'self', cardId: 'B07011' });
  const afterUse = await page.evaluate(() => {
    const w = window as unknown as { __game: { getState: () => { gameState: { players: { self: { hand: string[]; scene: { cardId: string }[] } }; pendingRps: unknown } } } };
    return w.__game.getState();
  });
  expect(afterUse.gameState.players.self.scene.map((c) => c.cardId)).toContain('B07011');
  await expect(page.locator('[data-testid="rps-modal"]')).toBeVisible();
  await page.locator('[data-testid="rps-rock"]').click();
  await expect(page.locator('[data-testid="rps-modal"]')).toBeHidden();
  expect(errors).toEqual([]);
});
