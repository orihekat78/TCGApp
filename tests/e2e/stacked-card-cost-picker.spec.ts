import { test, expect, type Page } from '@playwright/test';
import { buildGameState, expectNoConsoleErrors, getGameState, setupGamePage, type GameStateLike } from './helpers';

async function setHumanSelf(page: Page): Promise<void> {
  await page.evaluate(() => {
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
  });
}

function applyFixture(state: GameStateLike): void {
  const self = state.players.self as unknown as {
    partner: { cardId: string; state: string; location: string };
    scene: unknown[];
    hand: string[];
  };
  self.partner.cardId = 'D08001';
  self.partner.state = 'active';
  self.partner.location = 'partner-area';
  self.hand = [];
  self.scene = [{
    uid: 'agasa', cardId: 'B08003', state: 'active', isNamed: false, enterOrder: 1,
    setCards: [], stackedCards: [
      { cardId: 'D02015', instanceId: 'stack:agasa:a' },
      { cardId: 'D05015', instanceId: 'stack:agasa:b' },
      { cardId: 'D01015', instanceId: 'stack:agasa:c' },
      { cardId: 'D11020', instanceId: 'stack:agasa:d' },
    ], keywordOverrides: { granted: [], disabledOriginal: false }, apOverride: null, lpOverride: null,
    turnEffects: { contactImmune: false, removeOnTurnEnd: false }, declaredUseCount: {},
  }];
  (state as unknown as { turn: { number: number; player: string; phase: string; isFirstPlayerFirstTurn: boolean } }).turn = {
    number: 3, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false,
  };
  (state as unknown as { pendingEffects: unknown[] }).pendingEffects = [];
}

test('B08003 human stacked cost picks non-first exact identities', async ({ page }) => {
  const { errors } = await setupGamePage(page);
  await setHumanSelf(page);
  await buildGameState(page, applyFixture);

  await page.locator('[data-action-id="declared-ability"]').click();
  await page.locator('[data-uid="agasa"]').click();
  await page.locator('.confirm-ok').click();

  const modal = page.getByTestId('stacked-card-cost-modal');
  await expect(modal).toBeVisible();
  const html = await modal.innerHTML();
  for (const cardId of ['D02015', 'D05015', 'D01015', 'D11020']) expect(html).toContain(cardId);
  await expect(modal.locator('[data-card-id]')).toHaveCount(4);
  await expect(modal.locator('[data-testid="selectable-card-tile-detail"]')).toHaveCount(4);
  const contrast = await modal.locator('.selectable-card-tile__name').first().evaluate((element) => {
    const parse = (value: string): [number, number, number] => {
      const channels = value.match(/[\d.]+/g)?.slice(0, 3).map(Number) ?? [0, 0, 0];
      return [channels[0]!, channels[1]!, channels[2]!];
    };
    const luminance = ([r, g, b]: [number, number, number]): number => {
      const linear = [r, g, b].map((channel) => {
        const normalized = channel / 255;
        return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * linear[0]! + 0.7152 * linear[1]! + 0.0722 * linear[2]!;
    };
    const foreground = luminance(parse(getComputedStyle(element).color));
    const background = luminance(parse(getComputedStyle(element.closest('.selectable-card-tile')!).backgroundColor));
    return (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05);
  });
  expect(contrast).toBeGreaterThanOrEqual(4.5);
  await page.locator('[data-testid="card-list-pick-stack:agasa:b"]').click();
  await page.locator('[data-testid="card-list-pick-stack:agasa:c"]').click();
  await page.locator('[data-testid="card-list-pick-stack:agasa:d"]').click();
  await page.locator('[data-testid="card-list-pick-confirm"]').click();

  await page.waitForFunction(() => {
    const game = (window as unknown as {
      __game: { getState: () => { gameState: { players: { self: { scene: Array<{ uid: string; stackedCards: unknown[]; state: string }> } } } } };
    }).__game.getState().gameState;
    const source = game.players.self.scene.find((char) => char.uid === 'agasa');
    return source?.state === 'sleep' && source.stackedCards.length === 1;
  });
  const after = await getGameState(page);
  const self = after.players.self as unknown as {
    scene: { uid: string; stackedCards: { instanceId: string }[] }[];
    remove: string[];
  };
  const source = self
    .scene.find((char) => char.uid === 'agasa')!;
  expect(source.stackedCards.map((card) => card.instanceId)).toEqual(['stack:agasa:a']);
  expect(self.remove.slice(-3)).toEqual(['D05015', 'D01015', 'D11020']);
  expectNoConsoleErrors(errors);
});

test('B08003 stacked cost cancel leaves the host unchanged', async ({ page }) => {
  const { errors } = await setupGamePage(page);
  await setHumanSelf(page);
  await buildGameState(page, applyFixture);

  await page.locator('[data-action-id="declared-ability"]').click();
  await page.locator('[data-uid="agasa"]').click();
  await page.locator('.confirm-ok').click();
  const modal = page.getByTestId('stacked-card-cost-modal');
  await expect(modal).toBeVisible();
  const html = await modal.innerHTML();
  for (const cardId of ['D02015', 'D05015', 'D01015', 'D11020']) expect(html).toContain(cardId);
  await modal.getByTestId('stacked-card-cost-cancel').click();

  await page.waitForFunction(() => {
    const game = (window as unknown as {
      __game: { getState: () => { gameState: { players: { self: { scene: Array<{ uid: string; stackedCards: unknown[]; state: string }> } } } } };
    }).__game.getState().gameState;
    const source = game.players.self.scene.find((char) => char.uid === 'agasa');
    return source?.state === 'active' && source.stackedCards.length === 4;
  });
  expectNoConsoleErrors(errors);
});

test('stack identities remain inspectable while a scene target decision is pending', async ({ page }) => {
  const { errors } = await setupGamePage(page);
  await setHumanSelf(page);
  await buildGameState(page, (state) => {
    const self = state.players.self as unknown as {
      partner: { cardId: string; state: string; location: string };
      scene: unknown[];
      hand: string[];
    };
    self.partner = { cardId: 'D08001', state: 'active', location: 'partner-area' };
    self.hand = [];
    self.scene = [
      {
        uid: 'agasa', cardId: 'B06005', state: 'active', isNamed: false, enterOrder: 1,
        setCards: [], stackedCards: [
          { cardId: 'D02015', instanceId: 'stack:agasa:a' },
          { cardId: 'D05015', instanceId: 'stack:agasa:b' },
        ], keywordOverrides: { granted: [], disabledOriginal: false }, apOverride: null, lpOverride: null,
        turnEffects: { contactImmune: false, removeOnTurnEnd: false }, declaredUseCount: {},
      },
      {
        uid: 'target-host', cardId: 'D08003', state: 'active', isNamed: false, enterOrder: 2,
        setCards: [], stackedCards: [], keywordOverrides: { granted: [], disabledOriginal: false },
        apOverride: null, lpOverride: null,
        turnEffects: { contactImmune: false, removeOnTurnEnd: false }, declaredUseCount: {},
      },
    ];
    (state as unknown as { turn: { number: number; player: string; phase: string; isFirstPlayerFirstTurn: boolean } }).turn = {
      number: 3, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false,
    };
    (state as unknown as { pendingEffects: unknown[] }).pendingEffects = [];
  });

  await page.locator('[data-action-id="declared-ability"]').click();
  await page.locator('[data-uid="agasa"]').click();
  await page.locator('.confirm-ok').click();
  await expect(page.getByTestId('scene-card-pick-target-host')).toBeVisible();

  const inspect = page.getByTestId('scene-stack-inspect-agasa');
  await inspect.focus();
  await page.keyboard.press('Enter');
  const modal = page.locator('.card-list-modal');
  await expect(modal).toBeVisible();
  await expect(modal.getByTestId('card-list-detail-D02015-0')).toBeVisible();
  await expect(modal.getByTestId('card-list-detail-D05015-1')).toBeVisible();
  await modal.locator('.card-list-modal-close').click();

  await expect(page.getByTestId('scene-card-pick-target-host')).toBeVisible();
  expectNoConsoleErrors(errors);
});
