import { expect, test, type Page } from '@playwright/test';
import { buildGameState, expectNoConsoleErrors, setupGamePage, type GameStateLike } from './helpers';

type Row = {
  cardId: 'B09003' | 'B09108' | 'B09111';
  area: 'scene' | 'partner-area' | 'case';
};

const ROWS: Row[] = [
  { cardId: 'B09003', area: 'scene' },
  { cardId: 'B09108', area: 'partner-area' },
  { cardId: 'B09111', area: 'case' },
];

async function primeHuman(page: Page): Promise<void> {
  await page.evaluate(() => {
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
    const store = (window as unknown as {
      __game: { store: { getState: () => {
        setSpectatorMode: (value: boolean) => void;
        setAiPaused: (value: boolean) => void;
      } } };
    }).__game.store.getState();
    store.setSpectatorMode(false);
    store.setAiPaused(true);
  });
}

function installSource(state: GameStateLike, row: Row): void {
  const self = state.players.self as unknown as {
    scene: Array<Record<string, unknown>>;
    partnerAreaMR: Record<string, unknown> | null;
    case: Record<string, unknown>;
    deck: string[];
    remove: string[];
    evidence: Array<{ cardId: string; faceUp: boolean; origin: { turn: number; via: string } }>;
  };
  const opp = state.players.opp as unknown as {
    file: Array<{ type: string; cardId: string }>;
    deck: string[];
  };
  const base = self.scene[0]!;
  const source = {
    ...base,
    uid: 'wave105-source',
    cardId: row.cardId,
    state: 'active',
    declaredUseCount: {},
  };
  self.scene = [];
  self.partnerAreaMR = null;
  self.case = { ...self.case, cardId: '', declaredUseCount: {} };
  self.deck = ['D08003', 'D08007', 'D08003'];
  self.remove = [];
  self.evidence = [];
  opp.file = [{ type: 'card-back', cardId: 'B10065' }];
  opp.deck = ['D08003', 'D08007'];

  if (row.area === 'scene') {
    self.scene = [
      source,
      { ...base, uid: 'wave105-bond', cardId: 'D02001', state: 'active', declaredUseCount: {} },
    ];
  } else if (row.area === 'partner-area') {
    self.partnerAreaMR = source;
  } else {
    self.case = {
      ...self.case,
      cardId: row.cardId,
      colors: ['青', '緑'],
      status: '解決編',
      requiredEvidence: 7,
      declaredUseCount: {},
    };
    self.evidence = [0, 1].map(index => ({
      cardId: `D0800${index + 3}`,
      faceUp: false,
      origin: { turn: 1, via: 'reasoning' },
    }));
  }
  (state as unknown as { turn: unknown }).turn = {
    number: 5,
    player: 'self',
    phase: 'main',
    isFirstPlayerFirstTurn: false,
  };
  (state as unknown as { pendingEffects: unknown[] }).pendingEffects = [];
}

async function stateJson(page: Page): Promise<string> {
  return page.evaluate(() => JSON.stringify((window as unknown as {
    __game: { getState: () => { gameState: unknown } };
  }).__game.getState().gameState));
}

async function openNameModal(page: Page, row: Row): Promise<void> {
  await page.locator('[data-action-id="declared-ability"]').click();
  if (row.area === 'scene') {
    await page.locator('[data-uid="wave105-source"]').click();
  } else if (row.area === 'partner-area') {
    await page.getByTestId('pa-mr-self').click();
  } else {
    await page.locator('.case-area--candidate').click();
  }
  await page.locator('.confirm-modal-footer .confirm-ok').click();
  if (row.area === 'case') {
    await page.getByTestId('card-list-pick-evidence:self:0').click();
    await page.getByTestId('card-list-pick-evidence:self:1').click();
    await page.getByTestId('card-list-pick-confirm').click();
  }
  await expect(page.getByTestId('declare-card-name-modal')).toBeVisible();
}

test('Wave105 scene, partner-MR, and case sources open the all-card modal and cancel atomically', async ({ page }) => {
  const { errors } = await setupGamePage(page);
  await primeHuman(page);

  for (const row of ROWS) {
    await buildGameState(page, installSource, row);
    const before = await stateJson(page);
    await openNameModal(page, row);
    const modal = page.getByTestId('declare-card-name-modal');
    await expect(modal.getByTestId('declare-card-name-domain-guidance')).toContainText('登録済みのカード名');
    await expect(modal.getByTestId('declare-card-name-domain-guidance')).not.toContainText('キャラクターカード名');
    await modal.getByTestId('declare-card-name-cancel').click();
    await expect(modal).toBeHidden();
    await expect.poll(() => stateJson(page)).toBe(before);
  }

  expectNoConsoleErrors(errors);
});
