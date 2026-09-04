import { expect, test, type Page } from '@playwright/test';
import { buildGameState, expectNoConsoleErrors, getGameState, setupGamePage, type GameStateLike } from './helpers';

function fixture(state: GameStateLike): void {
  const character = (cardId: string, uid: string) => ({
    cardId, uid, state: 'active', isNamed: false, enterOrder: 1, setCards: [], stackedCards: 0,
    keywordOverrides: { granted: [], disabledOriginal: false }, apOverride: null, lpOverride: null,
    turnEffects: { contactImmune: false, removeOnTurnEnd: false }, declaredUseCount: {},
  });
  const game = state as unknown as {
    players: { self: Record<string, unknown>; opp: Record<string, unknown> };
    pendingEffects: unknown[];
    turn: { number: number; player: string; phase: string; isFirstPlayerFirstTurn: boolean };
  };
  game.players.self.scene = [character('B08093', 'source')];
  game.players.self.hand = ['B09007', 'B08093', 'B08042'];
  game.players.self.remove = [];
  game.players.opp.scene = [character('B09007', 'victim')];
  game.players.opp.hand = [];
  game.players.opp.remove = [];
  game.pendingEffects = [];
  game.turn = { number: 3, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
}

async function setHumanSelf(page: Page): Promise<void> {
  await page.evaluate(() => {
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
  });
}

test('B08093 selects the exact reveal-cost occurrence and presents only it before removal', async ({ page }) => {
  if (test.info().project.name === 'mobile-chromium') {
    await page.setViewportSize({ width: 851, height: 393 });
  }
  const { errors } = await setupGamePage(page);
  await setHumanSelf(page);
  await buildGameState(page, fixture);

  await page.locator('[data-action-id="declared-ability"]').click();
  await page.locator('[data-uid="source"]').click();
  await page.getByTestId('cp-opt-0').click();
  await page.locator('.confirm-ok').click();

  const costPicker = page.locator('.card-list-modal');
  await expect(costPicker.getByTestId('card-list-pick-hand:self:0')).toBeVisible();
  await expect(costPicker.getByTestId('card-list-pick-hand:self:1')).toBeVisible();
  await expect(costPicker.getByTestId('card-list-pick-hand:self:2')).toHaveCount(0);
  await costPicker.getByTestId('card-list-pick-hand:self:1').click();

  const reveal = page.getByTestId('public-hand-reveal-window');
  await expect(reveal).toBeVisible();
  await expect(reveal.locator('[data-testid^="public-hand-reveal-card-"]')).toHaveCount(1);
  await expect(reveal.getByTestId('public-hand-reveal-card-0')
    .getByRole('img', { name: '灰原哀＆シェリー' })).toBeVisible();
  let state = await getGameState(page);
  expect((state.players.self as unknown as { hand: string[] }).hand).toEqual(['B09007', 'B08093', 'B08042']);

  await page.getByTestId('public-hand-reveal-close').click();
  await page.locator('[data-uid="victim"]').click();
  state = await getGameState(page);
  expect((state.players.opp as unknown as { remove: string[] }).remove).toContain('B09007');
  expectNoConsoleErrors(errors);
});
