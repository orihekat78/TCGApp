// E2E: BUG-122 — matchOneFilter の filter.keyword がアイコン能力 (カットイン) を未検出だったバグの実機検証。
//
// 症状: カットイン は keywords[] ではなく ability 構造 (triggered + scope:'on-hand' +
//   trigger:{hook:'effect:declared', optional:true}) で表現される。matchOneFilter は keywords[] のみ
//   見ていたため filter.keyword:'カットイン' が **どのカードにも一致せず**、B05112 a1
//   「手札から【カットイン】を持つレベル5以下の【黒】のキャラを1枚まで登場」が候補0で機能しなかった。
//
// 本 spec は B05112 の宣言能力を実機で発火し、候補が **カットイン持ち黒 Lv≤5 char のみ** で、
//   level 超過 (B06099 黒 Lv8 cutin) / 非カットイン非黒 (B05037 緑 Lv2) が除外されることを assert する。
//   修正前: 候補0 (pick が surface しない or 空) / 修正後: B05110 のみ候補。
//
// seam: __game.setGameState (bug-117/118-120 と同パターン)。
import { test, expect, type Page } from '@playwright/test';
import { setupGamePage, buildGameState, dispatchAction } from './helpers';

async function prime(page: Page): Promise<void> {
  await page.evaluate(() => {
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
    const w = window as unknown as { __game: { store: { getState: () => { setSpectatorMode: (v: boolean) => void } } } };
    w.__game.store.getState().setSpectatorMode(false);
  });
}

async function getPendingEffectPick(page: Page): Promise<{
  atomVerb: string;
  candidates: { uid?: string; cardId: string; player: string }[];
} | null> {
  return (await page.evaluate(() => {
    const w = window as unknown as { __game: { getState: () => { pendingEffectPick: unknown } } };
    return w.__game.getState().pendingEffectPick;
  })) as { atomVerb: string; candidates: { uid?: string; cardId: string; player: string }[] } | null;
}

type AnyState = Record<string, unknown>;

test.describe('BUG-122 filter.keyword カットイン (icon-keyword) (2026-06-06)', () => {
  test('B05112: カットイン持ち黒Lv5 (B05110) のみ候補。Lv8 (B06099) / 緑非カットイン (B05037) は除外', async ({ page }) => {
    const { errors } = await setupGamePage(page);
    await prime(page);
    await buildGameState(page, (gs: AnyState) => {
      const mkC = (cardId: string, uid: string, state = 'active') => ({ cardId, uid, state, isNamed: false, enterOrder: 1, setCards: [], stackedCards: 0, keywordOverrides: { granted: [], disabledOriginal: false }, apOverride: null, lpOverride: null, turnEffects: { contactImmune: false, removeOnTurnEnd: false }, declaredUseCount: {} });
      const self = (gs.players as AnyState).self as AnyState;
      self.partner = { cardId: 'D08001', state: 'active', location: 'partner-area' };
      self.case = { cardId: 'D08026', status: '事件編', requiredEvidence: 7, colors: ['黒'], declaredUseCount: {} };
      self.scene = [mkC('B05112', 'bbn#1')]; // B05112 バーボン (active — sleepSelf cost 可)
      // 手札: B05110(黒 Lv5 cutin=正), B06099(黒 Lv8 cutin=level超過), B05037(緑 Lv2 非cutin=色/keyword不一致)
      self.hand = ['B05110', 'B06099', 'B05037'];
      self.evidence = []; self.remove = []; self.deck = ['D08005', 'D08013'];
      gs.pendingEffects = [];
      gs.turn = { number: 3, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    });

    await dispatchAction(page, { type: 'declaredAbility', uid: 'bbn#1', abilId: 'a1' });

    await expect
      .poll(async () => (await getPendingEffectPick(page))?.atomVerb ?? null, { timeout: 5000 })
      .toBe('sceneEnter');
    const pending = await getPendingEffectPick(page);
    const ids = (pending?.candidates ?? []).map((c) => c.cardId);
    expect(ids, 'カットイン持ち黒Lv5 の B05110 が候補 (修正前は候補0)').toContain('B05110');
    expect(ids, 'B06099 は黒カットインだが Lv8 で除外 (levelMax:5)').not.toContain('B06099');
    expect(ids, 'B05037 は緑かつ非カットインで除外').not.toContain('B05037');
    expect(errors).toEqual([]);
  });
});
