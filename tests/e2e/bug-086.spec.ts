// E2E regression: BUG-086 — 証拠エリアの「表向き」カードが evidenceToHand pick で選択不可
//
// シナリオ (D08013 吉田歩美【登場時】証拠を1つ得る→証拠を1つ選び手札に加える→手札1枚リムーブ):
//   1. self 手札に D08013、証拠エリアに「表向き 1 枚 + 裏向き 1 枚」を配置
//   2. handUseCard D08013 で登場 → evidenceGain(+1) → evidenceToHand pick modal が auto-open
//   3. 旧バグ: 表向き証拠 cell (index 0) が pickCands にあるのに click 不可 (CardListModal の
//      表向き分岐が findFaceDownPickUid を通っていなかった) → 非公開カードしか選べない
//   4. 修正後: 表向き cell も pickable button (card-list-pick-evidence:self:0) として描画され、
//      クリックすると当該証拠が手札に加わる
//
// 関連: BUG-085 (flip picker は候補が裏向き index のみ → 表向きは非 pick のまま、本修正の影響なし)

import { test, expect, type Page } from '@playwright/test';
import {
  setupGamePage,
  buildGameState,
  getGameState,
  dispatchAction,
  expectNoConsoleErrors,
  type GameStateLike,
} from './helpers';

function applyFixture(gs: GameStateLike): void {
  const self = gs.players.self as unknown as {
    partner: { cardId: string; state: string; location: string };
    case: { cardId: string; status: string; requiredEvidence: number; colors: string[]; declaredUseCount: Record<string, number> };
    hand: string[];
    deck: string[];
    file: { type: 'card-back'; cardId: string }[];
    scene: unknown[];
    evidence: { cardId: string; faceUp: boolean; origin: { turn: number; via: string } }[];
  };
  const opp = gs.players.opp as unknown as { scene: unknown[]; hand: string[] };

  self.partner.cardId = 'D08001';
  self.partner.state = 'active';
  self.partner.location = 'partner-area';

  self.case.cardId = 'D08026';
  self.case.status = '事件編';
  self.case.requiredEvidence = 7;
  self.case.colors = ['青'];
  self.case.declaredUseCount = {};

  // D08013 を手札使用で登場させる (青 ⊆ 事件青、level 4 ≤ FILE 枚数)
  self.hand = ['D08013'];
  self.scene = [];
  // FILE 8 枚 (D08013 level4 の levelAllowed を通過させる)
  const fb = { type: 'card-back' as const, cardId: 'D08007' };
  self.file = [fb, fb, fb, fb, fb, fb, fb, fb];
  // evidenceGain / discard 用にデッキを確保
  self.deck = ['D08011', 'D08015', 'D08017', 'D08023'];

  // 証拠 index 0 = 表向き / 1 = 裏向き
  self.evidence = [
    { cardId: 'D08003', faceUp: true, origin: { turn: 1, via: 'reasoning' } },
    { cardId: 'D08007', faceUp: false, origin: { turn: 1, via: 'reasoning' } },
  ];

  opp.scene = [];
  opp.hand = [];

  (gs as unknown as { turn: { number: number; player: string; phase: string; isFirstPlayerFirstTurn: boolean } }).turn = {
    number: 3, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false,
  };
  (gs as unknown as { pendingEffects: unknown[] }).pendingEffects = [];
  const ts = (gs as unknown as { turnState: { self: { handUseUsed: boolean; nextHintUsed: boolean } } }).turnState;
  ts.self.handUseUsed = false;
  ts.self.nextHintUsed = false;
}

async function setHumanSelf(page: Page): Promise<void> {
  await page.evaluate(() => {
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
  });
}

test.describe('BUG-086 — 証拠の表向きカードも evidenceToHand で選択可能 (実機クリック)', () => {
  test('D08013 登場 → 証拠 pick で表向き証拠 (index 0) が選択でき、手札に加わる', async ({ page }) => {
    const { errors } = await setupGamePage(page);
    await setHumanSelf(page);
    await buildGameState(page, applyFixture);

    // 1) D08013 を手札使用 (登場) → 登場時 sequence: evidenceGain → evidenceToHand pick
    await dispatchAction(page, { type: 'handUseCard', player: 'self', cardId: 'D08013' });

    // 2) 証拠エリア pick modal が auto-open し、表向き証拠 (index 0) が「選択可能」cell として描画される
    //    旧バグではこの cell は存在せず (非 click)、非公開カードしか選べなかった。
    const faceUpPick = page.locator('[data-testid="card-list-pick-evidence:self:0"]');
    await expect(faceUpPick, '表向き証拠 index 0 が pickable').toBeVisible({ timeout: 5000 });
    // 裏向き (index 1) も従来通り選択可
    await expect(page.locator('[data-testid="card-list-pick-evidence:self:1"]')).toBeVisible();

    // 3) 表向き証拠を選択 → 当該証拠 (D08003) が手札に加わる
    await faceUpPick.click();

    await page.waitForFunction(() => {
      const w = window as unknown as { __game: { getState: () => { gameState: { players: { self: { hand: string[] } } } } } };
      return w.__game.getState().gameState.players.self.hand.includes('D08003');
    }, { timeout: 5000 });

    const state = await getGameState(page);
    const self = state.players.self as unknown as { hand: string[]; evidence: { cardId: string }[] };
    expect(self.hand, '表向き証拠 D08003 が手札に加わった').toContain('D08003');
    expect(self.evidence.some((e) => e.cardId === 'D08003'), '証拠から D08003 が除かれた').toBe(false);

    expectNoConsoleErrors(errors);
  });
});
