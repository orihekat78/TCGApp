// E2E: 夜間 W0 (2026-07-11) — cost kind:'choice' human branch 選択 (B09027 初 consumer) +
//      EffectPickerModal multi-select mode (B08019 a2「合わせて2枚 (自分と相手で1枚ずつ)」)。
//
// 実機クリック経路 (click → effect resolution → state 反映):
//   Test1 (B09027): 宣言能力 → source click → 発動 → ChoicePicker (2 branch) → 手札 branch →
//                   scene direct pick (sleep キャラ) → スタン + 手札消費 + セット不変
//   Test2 (B08019): 宣言能力 → source click → 発動 → optional「する」→ EffectPickerModal multi
//                   (perSideMax=1) → 両陣営 1 枚ずつ選択 → 確定 → セット2枚除去 + draw1
//
// rules: 03 (スタン) / 15 (してもよい・まで) / 16 (裏向きセット) / 21 (コスト択一) / 25 (そうした場合)

import { test, expect, type Page } from '@playwright/test';
import {
  setupGamePage,
  buildGameState,
  getGameState,
  expectNoConsoleErrors,
  type GameStateLike,
} from './helpers';

// ⚠ buildGameState の fixture callback は page 側へ serialize されるため、外側 closure の
// helper は参照不可 (ReferenceError)。scene char factory は各 callback 内に inline する。
const MK_CHAR_SRC = `(uid, cardId, state, setCards = []) => ({
  uid, cardId, state, isNamed: false, enterOrder: 1, setCards, stackedCards: 0,
  keywordOverrides: { granted: [], disabledOriginal: false },
  apOverride: null, lpOverride: null,
  turnEffects: { contactImmune: false, removeOnTurnEnd: false },
  declaredUseCount: {},
})`;
void MK_CHAR_SRC;

async function setHumanSelf(page: Page): Promise<void> {
  await page.evaluate(() => {
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
  });
}

type MutGs = {
  players: {
    self: { partner: { cardId: string; state: string; location: string }; hand: string[]; deck: string[]; scene: unknown[]; evidence: unknown[] };
    opp: { scene: unknown[]; hand: string[] };
  };
  turn: { number: number; player: string; phase: string; isFirstPlayerFirstTurn: boolean };
  pendingEffects: unknown[];
};

test.describe('夜間 W0 — cost choice + multi-pick (実機クリック)', () => {
  test('B09027: cost ChoicePicker で手札 branch → sleep キャラをスタン (セット不変)', async ({ page }) => {
    const { errors } = await setupGamePage(page);
    await setHumanSelf(page);
    await buildGameState(page, (gs: GameStateLike) => {
      const mk = (uid: string, cardId: string, state: string, setCards: { cardId: string; faceUp: boolean }[] = []) => ({
        uid, cardId, state, isNamed: false, enterOrder: 1, setCards, stackedCards: 0,
        keywordOverrides: { granted: [], disabledOriginal: false },
        apOverride: null, lpOverride: null,
        turnEffects: { contactImmune: false, removeOnTurnEnd: false },
        declaredUseCount: {},
      });
      const g = gs as unknown as MutGs;
      g.players.self.partner = { cardId: 'D08001', state: 'active', location: 'partner-area' };
      g.players.self.scene = [
        mk('self-1', 'B09027', 'active', [{ cardId: 'D08003', faceUp: false }]),
        mk('self-2', 'D08013', 'active'), // active decoy (sleep filter で非候補)
      ];
      g.players.opp.scene = [mk('opp-1', 'D08013', 'sleep')];
      g.players.self.hand = ['D08007'];
      g.players.opp.hand = [];
      g.turn = { number: 3, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
      g.pendingEffects = [];
    });

    await page.locator('[data-action-id="declared-ability"]').click();
    await page.locator('[data-uid="self-1"]').click();
    await page.locator('.confirm-ok').click();

    // 3.6: cost choice — 2 branch が ChoicePicker で出る
    const modal = page.getByTestId('choice-picker-modal');
    await expect(modal).toBeVisible();
    await expect(page.getByTestId('cp-opt-0')).toContainText('セット');
    await expect(page.getByTestId('cp-opt-1')).toContainText('手札');
    await page.getByTestId('cp-opt-1').click(); // 手札 branch

    // 効果: sleep キャラ (opp-1) を scene 直接クリック — active decoy は候補外
    await page.locator('[data-uid="opp-1"]').click();

    await page.waitForFunction(() => {
      const w = window as unknown as { __game: { getState: () => { gameState: { players: { opp: { scene: { uid: string; state: string }[] } } } } } };
      const c = w.__game.getState().gameState.players.opp.scene.find((x) => x.uid === 'opp-1');
      return c != null && c.state === 'stun';
    }, { timeout: 5000 });

    const st = await getGameState(page);
    const self = st.players.self as unknown as { hand: string[]; scene: { uid: string; setCards: unknown[] }[] };
    expect(self.hand.length, '手札 branch: 1 枚リムーブ').toBe(0);
    expect(self.scene.find((c) => c.uid === 'self-1')!.setCards.length, 'セットカード不変 (branch 未選択側)').toBe(1);

    expectNoConsoleErrors(errors);
  });

  test('B08019 a2: optional する → multi EffectPickerModal (perSideMax=1) → 2枚除去 + draw1', async ({ page }) => {
    const { errors } = await setupGamePage(page);
    await setHumanSelf(page);
    await buildGameState(page, (gs: GameStateLike) => {
      const mk = (uid: string, cardId: string, state: string, setCards: { cardId: string; faceUp: boolean }[] = []) => ({
        uid, cardId, state, isNamed: false, enterOrder: 1, setCards, stackedCards: 0,
        keywordOverrides: { granted: [], disabledOriginal: false },
        apOverride: null, lpOverride: null,
        turnEffects: { contactImmune: false, removeOnTurnEnd: false },
        declaredUseCount: {},
      });
      const g = gs as unknown as MutGs;
      g.players.self.partner = { cardId: 'D08001', state: 'active', location: 'partner-area' };
      g.players.self.scene = [
        mk('self-1', 'B08019', 'active'),
        mk('self-2', 'D08013', 'active', [
          { cardId: 'D08003', faceUp: false },
          { cardId: 'D08011', faceUp: false }, // 同 host 2 枚目 — perSideMax=1 でも host 単位 1 選択
        ]),
      ];
      g.players.opp.scene = [mk('opp-1', 'D08013', 'active', [{ cardId: 'D08007', faceUp: false }])];
      g.players.self.hand = [];
      g.players.self.deck = ['D08026'];
      g.players.opp.hand = [];
      g.turn = { number: 3, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
      g.pendingEffects = [];
    });

    await page.locator('[data-action-id="declared-ability"]').click();
    await page.locator('[data-uid="self-1"]').click();
    await page.locator('.confirm-ok').click();

    // 「してもよい」optional → する
    await expect(page.getByTestId('optional-picker-modal')).toBeVisible();
    await page.getByTestId('opt-run-yes').click();

    // multi EffectPickerModal: 候補 = face-down set card の物理 occurrence。
    // perSideMax=1 は host 数ではなく、各 side から最大1枚を意味する。
    const picker = page.getByTestId('effect-picker-modal');
    await expect(picker).toBeVisible();
    const candidates = await page.evaluate(() => {
      const w = window as unknown as {
        __game: { getState: () => { pendingEffectPick: { candidates: unknown[] } | null } };
      };
      return w.__game.getState().pendingEffectPick?.candidates as {
        uid: string;
        hostUid?: string;
        setCardInstanceId?: string;
        hidden?: boolean;
      }[] | undefined;
    });
    expect(candidates).toHaveLength(3);
    const selfCandidates = candidates!.filter((candidate) => candidate.hostUid === 'self-2');
    const oppCandidate = candidates!.find((candidate) => candidate.hostUid === 'opp-1');
    expect(selfCandidates).toHaveLength(2);
    expect(new Set(selfCandidates.map((candidate) => candidate.setCardInstanceId)).size).toBe(2);
    expect(oppCandidate).toBeDefined();
    expect(candidates!.every((candidate) => candidate.hidden === true)).toBe(true);
    const confirmBtn = page.getByTestId('effect-picker-confirm');
    await expect(confirmBtn).toBeDisabled(); // 0 選択 (nMin=2 clamp 後も 2 必要)
    await page.getByTestId(`effect-pick-cand-${selfCandidates[0]!.uid}`).click();
    await expect(confirmBtn).toBeDisabled(); // 1/2
    await page.getByTestId(`effect-pick-cand-${oppCandidate!.uid}`).click();
    await expect(confirmBtn).toBeEnabled(); // 2/2 (各陣営 1)
    await confirmBtn.click();

    await page.waitForFunction(() => {
      const w = window as unknown as { __game: { getState: () => { gameState: { players: { self: { hand: string[] } } } } } };
      return w.__game.getState().gameState.players.self.hand.length === 1;
    }, { timeout: 5000 });

    const st = await getGameState(page);
    const self = st.players.self as unknown as { hand: string[]; scene: { uid: string; setCards: unknown[] }[] };
    const opp = st.players.opp as unknown as { scene: { uid: string; setCards: unknown[] }[] };
    expect(self.scene.find((c) => c.uid === 'self-2')!.setCards.length, 'self host 1 枚除去 (2→1)').toBe(1);
    expect(opp.scene.find((c) => c.uid === 'opp-1')!.setCards.length, 'opp host 除去 (1→0)').toBe(0);
    expect(self.hand.length, 'そうした場合 draw1').toBe(1);

    expectNoConsoleErrors(errors);
  });
});
