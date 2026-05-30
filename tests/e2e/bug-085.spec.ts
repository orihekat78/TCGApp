// E2E regression: BUG-085 — 事件カード宣言能力の flipFaceUpEvidence コスト picker
//
// 実機クリック経路 (click → effect resolution → state 反映) を検証する:
//   1. ACTIONS の「宣言能力」をクリック
//   2. source picker: 黄色強調された自分の事件カードをクリック (case:self)
//   3. 確認モーダルの「発動」をクリック
//   4. 証拠エリア拡大表示 (CardListModal pick mode) で裏向き証拠 2 枚を選択 → 「完了」
//   5. scene の少年探偵団キャラ (effect-pickable) をクリック (charModifyAP 対象)
//   6. 検証: 証拠 2 枚が表向き / 対象キャラ apMod_turn=+2000 / console error 0
//
// 旧バグ: 3 の「発動」後に何も起きなかった (cost.pay が indices 未供給で throw → rollback)。

import { test, expect, type Page } from '@playwright/test';
import {
  setupGamePage,
  buildGameState,
  getGameState,
  expectNoConsoleErrors,
  type GameStateLike,
} from './helpers';

function applyFixture(gs: GameStateLike): void {
  const self = gs.players.self as unknown as {
    partner: { cardId: string; state: string; location: string };
    case: { cardId: string; status: string; requiredEvidence: number; colors: string[]; declaredUseCount: Record<string, number> };
    hand: string[];
    scene: unknown[];
    evidence: { cardId: string; faceUp: boolean; origin: { turn: number; via: string } }[];
  };
  const opp = gs.players.opp as unknown as { scene: unknown[]; hand: string[] };

  self.partner.cardId = 'D08001';
  self.partner.state = 'active';
  self.partner.location = 'partner-area';

  // D08026「青の古城探索事件」を【解決編】に
  self.case.cardId = 'D08026';
  self.case.status = '解決編';
  self.case.requiredEvidence = 7;
  self.case.colors = ['青'];
  self.case.declaredUseCount = {};

  // 少年探偵団キャラ (D08013 吉田歩美) を active で 1 体
  self.scene = [
    {
      uid: 'self-1',
      cardId: 'D08013',
      state: 'active',
      isNamed: false,
      enterOrder: 1,
      setCards: [],
      stackedCards: 0,
      keywordOverrides: { granted: [], disabledOriginal: false },
      apOverride: null,
      lpOverride: null,
      turnEffects: { contactImmune: false, removeOnTurnEnd: false },
      declaredUseCount: {},
    },
  ];

  // 裏向き証拠 2 枚
  self.evidence = [
    { cardId: 'D08003', faceUp: false, origin: { turn: 1, via: 'reasoning' } },
    { cardId: 'D08007', faceUp: false, origin: { turn: 1, via: 'reasoning' } },
  ];
  self.hand = [];

  opp.scene = [];
  opp.hand = [];

  (gs as unknown as { turn: { number: number; player: string; phase: string; isFirstPlayerFirstTurn: boolean } }).turn = {
    number: 3,
    player: 'self',
    phase: 'main',
    isFirstPlayerFirstTurn: false,
  };
  (gs as unknown as { pendingEffects: unknown[] }).pendingEffects = [];
}

async function setHumanSelf(page: Page): Promise<void> {
  await page.evaluate(() => {
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
  });
}

test.describe('BUG-085 — 事件宣言能力 flipFaceUpEvidence コスト picker (実機クリック)', () => {
  test('宣言能力 → 事件選択 → 発動 → 証拠2枚選択 → キャラ選択 → AP+2000', async ({ page }) => {
    const { errors } = await setupGamePage(page);
    await setHumanSelf(page);
    await buildGameState(page, applyFixture);

    // 1) ACTIONS 「宣言能力」
    await page.locator('[data-action-id="declared-ability"]').click();

    // 2) source picker: 自分の事件カード (黄色強調) をクリック
    await page.locator('.case-area--candidate').click();

    // 3) 確認モーダル「発動」
    await page.locator('.confirm-ok').click();

    // 4) 証拠 flip picker: 裏向き証拠 2 枚を選択 → 完了
    await page.locator('[data-testid="card-list-pick-evidence:self:0"]').click();
    await page.locator('[data-testid="card-list-pick-evidence:self:1"]').click();
    await page.locator('[data-testid="card-list-pick-confirm"]').click();

    // 5) charModifyAP の対象 (少年探偵団キャラ) をクリック
    await page.locator('[data-uid="self-1"]').click();

    // 6) state 反映を待って検証
    await page.waitForFunction(() => {
      const w = window as unknown as { __game: { getState: () => { gameState: { players: { self: { scene: { uid: string; turnEffects: Record<string, unknown> }[] } } } } } };
      const sc = w.__game.getState().gameState.players.self.scene.find((c) => c.uid === 'self-1');
      return sc != null && sc.turnEffects['apMod_turn'] === 2000;
    }, { timeout: 5000 });

    const state = await getGameState(page);
    const self = state.players.self as unknown as {
      evidence: { faceUp: boolean }[];
      scene: { uid: string; turnEffects: Record<string, unknown> }[];
    };
    expect(self.evidence[0].faceUp, '証拠0が表向き').toBe(true);
    expect(self.evidence[1].faceUp, '証拠1が表向き').toBe(true);
    const char = self.scene.find((c) => c.uid === 'self-1')!;
    expect(char.turnEffects['apMod_turn'], '少年探偵団キャラに +2000 (2枚×1000)').toBe(2000);

    // 証拠エリアを開く → 表向きにした 2 枚が公開表示 (非公開のままにならない)
    await page.locator('.evidence-area[data-side="self"]').click();
    await expect(page.locator('[data-testid="card-list-evidence-faceup-0"]')).toBeVisible();
    await expect(page.locator('[data-testid="card-list-evidence-faceup-1"]')).toBeVisible();
    // 両方表向きなので「非公開」バック cell は残っていない
    await expect(page.locator('.card-list-modal .card-list-item.face-down')).toHaveCount(0);

    expectNoConsoleErrors(errors);
  });

  // BUG-085 review (Finding 1) 検証: 表向き証拠が混在しても、裏向き証拠の cell が
  // 絶対インデックスで正しく click 可能 (faceDownCount=全証拠枚数なので cell idx = 証拠配列 idx)。
  test('表向き証拠が混在: 裏向きのみ選択可 + 正しい絶対 index が flip される', async ({ page }) => {
    const { errors } = await setupGamePage(page);
    await setHumanSelf(page);
    await buildGameState(page, (gs) => {
      const self = gs.players.self as unknown as {
        partner: { cardId: string; state: string; location: string };
        case: { cardId: string; status: string; requiredEvidence: number; colors: string[]; declaredUseCount: Record<string, number> };
        hand: string[];
        scene: unknown[];
        evidence: { cardId: string; faceUp: boolean; origin: { turn: number; via: string } }[];
      };
      const opp = gs.players.opp as unknown as { scene: unknown[]; hand: string[] };
      self.partner.cardId = 'D08001'; self.partner.state = 'active'; self.partner.location = 'partner-area';
      self.case.cardId = 'D08026'; self.case.status = '解決編'; self.case.requiredEvidence = 7; self.case.colors = ['青']; self.case.declaredUseCount = {};
      self.scene = [{ uid: 'self-1', cardId: 'D08013', state: 'active', isNamed: false, enterOrder: 1, setCards: [], stackedCards: 0, keywordOverrides: { granted: [], disabledOriginal: false }, apOverride: null, lpOverride: null, turnEffects: { contactImmune: false, removeOnTurnEnd: false }, declaredUseCount: {} }];
      // 証拠 index 0 = 表向き / 1,2 = 裏向き
      self.evidence = [
        { cardId: 'D08003', faceUp: true, origin: { turn: 1, via: 'reasoning' } },
        { cardId: 'D08007', faceUp: false, origin: { turn: 1, via: 'reasoning' } },
        { cardId: 'D08011', faceUp: false, origin: { turn: 1, via: 'reasoning' } },
      ];
      self.hand = [];
      opp.scene = []; opp.hand = [];
      (gs as unknown as { turn: { number: number; player: string; phase: string; isFirstPlayerFirstTurn: boolean } }).turn = { number: 3, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
      (gs as unknown as { pendingEffects: unknown[] }).pendingEffects = [];
    });

    await page.locator('[data-action-id="declared-ability"]').click();
    await page.locator('.case-area--candidate').click();
    await page.locator('.confirm-ok').click();

    // 表向き (index 0) の cell は click 不可 (pickCands に無い)、裏向き 1,2 が click 可
    await expect(page.locator('[data-testid="card-list-pick-evidence:self:0"]')).toHaveCount(0);
    await page.locator('[data-testid="card-list-pick-evidence:self:1"]').click();
    await page.locator('[data-testid="card-list-pick-evidence:self:2"]').click();
    await page.locator('[data-testid="card-list-pick-confirm"]').click();

    await page.locator('[data-uid="self-1"]').click();

    await page.waitForFunction(() => {
      const w = window as unknown as { __game: { getState: () => { gameState: { players: { self: { scene: { uid: string; turnEffects: Record<string, unknown> }[] } } } } } };
      const sc = w.__game.getState().gameState.players.self.scene.find((c) => c.uid === 'self-1');
      return sc != null && sc.turnEffects['apMod_turn'] === 2000;
    }, { timeout: 5000 });

    const state = await getGameState(page);
    const self = state.players.self as unknown as { evidence: { faceUp: boolean }[] };
    expect(self.evidence[0].faceUp, '表向き証拠は不変').toBe(true);
    expect(self.evidence[1].faceUp, '裏向き index1 が表向きに').toBe(true);
    expect(self.evidence[2].faceUp, '裏向き index2 が表向きに').toBe(true);
    expectNoConsoleErrors(errors);
  });
});
