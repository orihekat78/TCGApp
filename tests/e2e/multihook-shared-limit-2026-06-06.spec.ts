// E2E: multi-hook 共有【ターン1】(reasoning:end + action:declare) を実機の本物のフローで検証。
//
// D03007 白馬探「【ターン1】このキャラが推理かアクションしたとき、カードを1枚引く。」
//   - 推理 (reasoning) で a1 が発火し1ドロー。
//   - 本物のアクション[事件] (actionAgainstCase) で action:declare が emit され a1 が発火し1ドロー。
//   ※ 推理/アクションはキャラをスリープさせるため「同ターンに両方」は再アクティブ化が要る edge case
//     (共有【ターン1】の数え方は unit test で網羅)。本 e2e は各 hook が実フローで発火することを確認。
//
// seam: __game.setGameState。
import { test, expect, type Page } from '@playwright/test';
import { setupGamePage, buildGameState, getGameState, dispatchAction } from './helpers';

type AnyState = Record<string, unknown>;

async function setHumanSelf(page: Page): Promise<void> {
  await page.evaluate(() => {
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
    const w = window as unknown as { __game: { store: { getState: () => { setSpectatorMode: (v: boolean) => void } } } };
    w.__game.store.getState().setSpectatorMode(false);
  });
}

test.describe('multi-hook 共有【ターン1】D03007 (2026-06-06)', () => {
  test('推理 (reasoning) で a1 発火 → 1ドロー', async ({ page }) => {
    const { errors } = await setupGamePage(page);
    await setHumanSelf(page);
    await buildGameState(page, (gs: AnyState) => {
      const mkC = (cardId: string, uid: string, state = 'active') => ({ cardId, uid, state, isNamed: false, enterOrder: 1, enterOrderThisTurn: 1, setCards: [], stackedCards: 0, keywordOverrides: { granted: [], disabledOriginal: false }, apOverride: null, lpOverride: null, turnEffects: { contactImmune: false, removeOnTurnEnd: false }, declaredUseCount: {} });
      const self = (gs.players as AnyState).self as AnyState;
      self.partner = { cardId: 'D08001', state: 'active', location: 'partner-area' };
      self.case = { cardId: 'D08026', status: '事件編', requiredEvidence: 7, colors: ['白'], declaredUseCount: {} };
      self.scene = [mkC('D03007', 'sh#1')];
      self.deck = ['D08005', 'D08006']; self.hand = []; self.evidence = []; self.remove = []; self.file = [];
      gs.pendingEffects = [];
      gs.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    });

    const handBefore = ((await getGameState(page)).players.self as { hand: string[] }).hand.length;
    await dispatchAction(page, { type: 'reasoning', uid: 'sh#1' });
    const handAfter = ((await getGameState(page)).players.self as { hand: string[] }).hand.length;
    expect(handAfter - handBefore, '推理で a1 が1ドロー').toBe(1);
    expect(errors).toEqual([]);
  });

  test('本物のアクション[事件] (action:declare) で a1 発火 → 1ドロー', async ({ page }) => {
    const { errors } = await setupGamePage(page);
    await setHumanSelf(page);
    await buildGameState(page, (gs: AnyState) => {
      const mkC = (cardId: string, uid: string, state = 'active') => ({ cardId, uid, state, isNamed: false, enterOrder: 1, enterOrderThisTurn: 1, setCards: [], stackedCards: 0, keywordOverrides: { granted: [], disabledOriginal: false }, apOverride: null, lpOverride: null, turnEffects: { contactImmune: false, removeOnTurnEnd: false }, declaredUseCount: {} });
      const self = (gs.players as AnyState).self as AnyState;
      const opp = (gs.players as AnyState).opp as AnyState;
      self.partner = { cardId: 'D08001', state: 'active', location: 'partner-area' };
      self.case = { cardId: 'D08026', status: '事件編', requiredEvidence: 7, colors: ['白'], declaredUseCount: {} };
      self.scene = [mkC('D03007', 'sh#1')];
      self.deck = ['D08005', 'D08006']; self.hand = []; self.evidence = []; self.remove = []; self.file = [];
      // opp: 事件に証拠1つ (action[事件] の対象条件) / 現場は空 (ガード不可で素通り)
      opp.partner = { cardId: 'D08001', state: 'active', location: 'partner-area' };
      opp.case = { cardId: 'D08026', status: '事件編', requiredEvidence: 6, colors: ['青'], declaredUseCount: {} };
      opp.scene = []; opp.deck = ['D08009', 'D08010', 'D08011'];
      opp.hand = []; opp.evidence = [{ cardId: 'D08003', faceUp: false }]; opp.remove = []; opp.file = [];
      gs.pendingEffects = [];
      gs.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    });

    const handBefore = ((await getGameState(page)).players.self as { hand: string[] }).hand.length;
    await dispatchAction(page, { type: 'actionAgainstCase', byUid: 'sh#1', targetPlayer: 'opp' });
    const after = await getGameState(page);
    const handAfter = (after.players.self as { hand: string[] }).hand.length;
    expect(handAfter - handBefore, '本物のアクション[事件]で a1 が1ドロー (action:declare 発火)').toBe(1);
    expect(errors).toEqual([]);
  });
});
