import { test, expect, type Page } from '@playwright/test';
import { setupGamePage, buildGameState, dispatchAction, getGameState, type GameStateLike } from './helpers';

async function setHumanSelf(page: Page): Promise<void> {
  await page.evaluate(() => {
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
  });
}

function applyB02039Fixture(gs: GameStateLike): void {
  const game = gs as unknown as Record<string, unknown>;
  const players = game.players as { self: Record<string, unknown>; opp: Record<string, unknown> };
  const makeChar = (cardId: string, uid: string, setCards: unknown[] = []) => ({
    cardId, uid, state: 'active', isNamed: false, enterOrder: 1, setCards, stackedCards: 0,
    keywordOverrides: { granted: [], disabledOriginal: false }, apOverride: null, lpOverride: null,
    turnEffects: { contactImmune: false, removeOnTurnEnd: false }, declaredUseCount: {},
  });
  players.self.partner = { cardId: 'D08001', state: 'active', location: 'partner-area' };
  players.self.scene = [makeChar('B02039', 'yusaku'), makeChar('B02040', 'toichi')];
  players.self.hand = [];
  players.self.deck = ['D08026'];
  players.self.evidence = [];
  players.opp.scene = [makeChar('D08013', 'opp-host', [
    { cardId: 'D08003', faceUp: false, instanceId: 'set:opp-host:alpha' },
    { cardId: 'D08003', faceUp: false, instanceId: 'set:opp-host:beta' },
  ])];
  players.opp.hand = [];
  players.opp.evidence = [];
  game.pendingEffects = [];
  game.turn = { number: 3, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
}

test('B02039 resolves the selected duplicate set-card occurrence through the real engine flow', async ({ page }, testInfo) => {
  if (testInfo.project.name === 'chromium') await page.setViewportSize({ width: 851, height: 393 });
  const { errors } = await setupGamePage(page);
  await setHumanSelf(page);
  await buildGameState(page, applyB02039Fixture);

  expect(await dispatchAction(page, { type: 'declaredAbility', uid: 'yusaku', abilId: 'a1' })).toEqual({ ok: true });
  await page.locator('[data-uid="opp-host"]').click();

  await expect(page.locator('[data-testid="set-card-choice-modal"]')).toBeVisible();
  const first = page.getByTestId('set-card-choice-1');
  const second = page.getByTestId('set-card-choice-2');
  await expect(first).toHaveAccessibleName('Set card 1 を選択');
  await expect(second).toHaveAccessibleName('Set card 2 を選択');
  const names = await page.locator('button[data-testid^="set-card-choice-"]').evaluateAll((choices) =>
    choices.map((choice) => choice.getAttribute('aria-label')),
  );
  expect(new Set(names).size).toBe(2);
  const modal = page.locator('[data-testid="set-card-choice-modal"]');
  await expect(modal.getByTestId('selectable-card-tile-detail')).toHaveCount(0);
  for (const choice of [first, second]) {
    const image = choice.locator('img.card-art.selectable-card-tile__back-art');
    await expect(image).toBeVisible();
    await expect.poll(() => image.evaluate((node) => {
      const back = node as HTMLImageElement;
      return back.complete && back.naturalWidth > 0 && back.currentSrc.startsWith('data:image/svg+xml');
    })).toBe(true);
    await expect(image).toHaveAttribute('alt', '');
    expect(await image.evaluate((node) => (node as HTMLImageElement).currentSrc)).not.toContain('D08003');
  }
  await expect(modal).not.toContainText('D08003');
  await expect(modal).not.toContainText('江戸川コナン');
  await expect(second).toHaveAttribute('data-instance-id', 'set:opp-host:beta');
  expect(await page.evaluate(() => {
    const game = (window as unknown as {
      __game: { getState: () => { pendingSetCardChoice: { decisionId?: string } | null } };
    }).__game;
    return game.getState().pendingSetCardChoice?.decisionId;
  })).toMatch(/^decision:\d+$/);
  if (testInfo.project.name === 'mobile-chromium') {
    expect(await page.evaluate(() => navigator.maxTouchPoints)).toBeGreaterThan(0);
    await second.tap();
  } else {
    await second.focus();
    await second.press('Enter');
  }
  await expect(page.locator('[data-testid="set-card-choice-modal"]')).toBeHidden();
  expect(await page.evaluate(() => {
    const game = (window as unknown as {
      __game: { getState: () => { pendingSetCardChoice: unknown | null } };
    }).__game;
    return game.getState().pendingSetCardChoice;
  })).toBeNull();
  const state = await getGameState(page);
  const opp = state.players.opp as unknown as {
    evidence: { cardId: string; faceUp: boolean }[];
    scene: { uid: string; setCards: { instanceId: string; cardId: string; faceUp: boolean }[] }[];
  };
  expect(opp.evidence).toHaveLength(1);
  expect(opp.evidence[0]).toMatchObject({
    cardId: 'D08003',
    faceUp: true,
    origin: { sourceCardId: 'B02039', turn: 3, via: 'effect' },
  });
  expect(opp.scene.find((char) => char.uid === 'opp-host')?.setCards).toEqual([
    { cardId: 'D08003', faceUp: false, instanceId: 'set:opp-host:alpha' },
  ]);
  expect(errors).toEqual([]);
});
