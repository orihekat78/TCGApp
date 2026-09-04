import { expect, test, type Page } from '@playwright/test';
import {
  buildGameState,
  expectNoConsoleErrors,
  getGameState,
  setupGamePage,
  type GameStateLike,
} from './helpers';

async function primeHuman(page: Page): Promise<void> {
  await page.evaluate(() => {
    (globalThis as { __humanPlayerSide?: 'self' }).__humanPlayerSide = 'self';
    const store = (window as unknown as {
      __game: {
        store: {
          getState: () => {
            setSpectatorMode: (value: boolean) => void;
            setAiPaused: (value: boolean) => void;
          };
        };
      };
    }).__game.store.getState();
    store.setSpectatorMode(false);
    store.setAiPaused(true);
  });
}

function applyWave35Fixture(state: GameStateLike): void {
  const makeChar = (cardId: string, uid: string, setCards: unknown[] = []) => ({
    cardId,
    uid,
    state: 'active',
    isNamed: false,
    enterOrder: 1,
    enterOrderThisTurn: 1,
    setCards,
    stackedCards: 0,
    keywordOverrides: { granted: [], disabledOriginal: false },
    apOverride: null,
    lpOverride: null,
    turnEffects: { contactImmune: false, removeOnTurnEnd: false },
    declaredUseCount: {},
  });
  const game = state as unknown as {
    players: {
      self: Record<string, unknown>;
      opp: Record<string, unknown>;
    };
    pendingEffects: unknown[];
    turn: { number: number; player: string; phase: string; isFirstPlayerFirstTurn: boolean };
  };

  game.players.self.partner = { cardId: 'D08001', state: 'active', location: 'partner-area' };
  game.players.self.scene = [makeChar('D08013', 'host', [
    { cardId: 'B10017', faceUp: true, instanceId: 'set:shoe:first' },
    { cardId: 'B10017', faceUp: true, instanceId: 'set:shoe:second' },
    { cardId: 'B10018', faceUp: true, instanceId: 'set:belt:first' },
    { cardId: 'B10018P', faceUp: true, instanceId: 'set:belt:second' },
  ])];
  game.players.self.hand = [];
  game.players.self.deck = [];
  game.players.self.remove = [];
  game.players.opp.scene = [makeChar('B10003', 'target')];
  game.players.opp.hand = [];
  game.players.opp.deck = [];
  game.players.opp.remove = [];
  game.pendingEffects = [];
  game.turn = { number: 3, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
}

test('Wave35: public declared flow preserves the selected duplicate set-card source end to end', async ({ page }, testInfo) => {
  if (testInfo.project.name === 'chromium') {
    await page.setViewportSize({ width: 1280, height: 720 });
  }
  const { errors } = await setupGamePage(page);
  await primeHuman(page);
  await buildGameState(page, applyWave35Fixture);

  await page.locator('[data-action-id="declared-ability"]').click();
  await page.locator('[data-uid="host"]').click();

  const abilityPicker = page.getByTestId('choice-picker-modal');
  await expect(abilityPicker).toBeVisible();
  await expect(abilityPicker.getByTestId('cp-opt-0')).toContainText('キック力増強シューズ（1件目）');
  await expect(abilityPicker.getByTestId('cp-opt-1')).toContainText('キック力増強シューズ（2件目）');
  await expect(abilityPicker).not.toContainText('set:shoe:');
  await abilityPicker.getByTestId('cp-opt-1').click();

  await expect(page.locator('.confirm-modal-footer .confirm-ok')).toBeVisible();
  await page.locator('.confirm-modal-footer .confirm-ok').click();

  const costPicker = page.getByTestId('set-card-choice-modal');
  await expect(costPicker).toBeVisible();
  await expect(costPicker.locator('[data-testid^="set-card-choice-"]')).toHaveCount(2);
  await costPicker.locator('[data-instance-id="set:belt:second"]').click();
  await costPicker.getByTestId('set-card-cost-confirm').click();

  const banner = page.locator('.scene-pick-skip-banner');
  await expect(banner).toContainText('キック力増強シューズ（通常版・2枚目）');
  await expect(banner).toContainText('現場のキャラを1枚選んでリムーブしてください');
  await expect(banner).not.toContainText('set:shoe:second');
  await expect(page.getByTestId('effect-picker-modal')).toBeHidden();
  await page.locator('[data-uid="target"]').click();

  await expect.poll(async () => {
    const state = await getGameState(page) as unknown as {
      players: {
        self: {
          remove: string[];
          scene: Array<{
            uid: string;
            setCards: Array<{
              instanceId: string;
              abilityUseCounts?: Record<string, { turn: number; count: number }>;
            }>;
          }>;
        };
        opp: { remove: string[]; scene: Array<{ uid: string }> };
      };
    };
    const host = state.players.self.scene.find((char) => char.uid === 'host');
    const first = host?.setCards.find((entry) => entry.instanceId === 'set:shoe:first');
    const second = host?.setCards.find((entry) => entry.instanceId === 'set:shoe:second');
    return {
      firstCount: first?.abilityUseCounts?.a2?.count ?? 0,
      secondCount: second?.abilityUseCounts?.a2?.count ?? 0,
      remainingSetCards: host?.setCards.map((entry) => entry.instanceId).sort() ?? [],
      targetStillInScene: state.players.opp.scene.some((char) => char.uid === 'target'),
      opponentRemove: state.players.opp.remove,
      selfRemove: state.players.self.remove,
    };
  }).toEqual({
    firstCount: 0,
    secondCount: 1,
    remainingSetCards: ['set:belt:first', 'set:shoe:first', 'set:shoe:second'],
    targetStillInScene: false,
    opponentRemove: ['B10003'],
    selfRemove: ['B10018P'],
  });
  expectNoConsoleErrors(errors);
});
