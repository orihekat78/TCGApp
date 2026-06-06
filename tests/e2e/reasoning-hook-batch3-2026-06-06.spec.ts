// E2E: engine-extension reasoning-hook batch #3 (2026-06-06 タスクC) 実機 text-faithfulness 検証。
//
// B05039 松田左文字「このキャラが推理したとき、レベル5のキャラを2枚までと、レベル7のキャラを1枚まで選び、
//   ターン終了時までAP＋1000する。」— reasoning:end selfOnly + 2 段 multi-target charModifyAP pick。
//   human 経路で「候補列挙 = テキスト文言」を確認: pick#1 は Lv5 のみ (Lv4/Lv6 decoy 除外, max:2)、
//   pick#2 は Lv7 のみ (max:1)。選択した札のみ AP+1000、decoy は不変 (card-addition-checklist §7)。
//
// B03096 目暮十三「【ターン1】自分の現場のキャラが推理したとき、捜査1。レベル8以上が発見されたら1枚引く。」
//   — reasoning:end + triggerCharMatches{self} + deckRevealUntil(opp,maxN:1) で 捜査1 を代替。
//   相手デッキ上=Lv8 → 自分1ドロー + その札は相手デッキ下へ / Lv7 → ドローなし。
//
// seam: __game.setGameState (bug-117/118-120 / reasoning-hook spec と同パターン)。
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

async function getPendingEffectPick(page: Page): Promise<{
  candidates: { uid: string; cardId: string; player: string }[];
  atomVerb: string;
  nMin: number;
  nMax: number;
} | null> {
  return page.evaluate(() => {
    const w = window as unknown as { __game: { getState: () => { pendingEffectPick: unknown } } };
    return w.__game.getState().pendingEffectPick as never;
  });
}

async function apOf(page: Page, uid: string): Promise<number> {
  return page.evaluate((u) => {
    const w = window as unknown as { __game: { getState: () => { gameState: unknown }; read: { char: { ap: (s: unknown, uid: string) => number } } } };
    return w.__game.read.char.ap(w.__game.getState().gameState, u);
  }, uid);
}

test.describe('reasoning-hook batch #3 (2026-06-06)', () => {
  test('B05039: 推理→ pick#1=Lv5のみ(2枚, decoy除外) / pick#2=Lv7のみ(1枚)、選択札+1000・decoy不変', async ({ page }) => {
    const { errors } = await setupGamePage(page);
    await setHumanSelf(page);
    await buildGameState(page, (gs: AnyState) => {
      const mkC = (cardId: string, uid: string, state = 'active') => ({ cardId, uid, state, isNamed: false, enterOrder: 1, enterOrderThisTurn: 1, setCards: [], stackedCards: 0, keywordOverrides: { granted: [], disabledOriginal: false }, apOverride: null, lpOverride: null, turnEffects: { contactImmune: false, removeOnTurnEnd: false }, declaredUseCount: {} });
      const self = (gs.players as AnyState).self as AnyState;
      const opp = (gs.players as AnyState).opp as AnyState;
      self.partner = { cardId: 'D08001', state: 'active', location: 'partner-area' };
      self.case = { cardId: 'D08026', status: '事件編', requiredEvidence: 7, colors: ['緑'], declaredUseCount: {} };
      self.hand = []; self.evidence = []; self.remove = []; self.file = [];
      // B05039 (緑Lv4) + Lv5×2 (D08009/D08010) + Lv7 (D08022) + decoy Lv4 (D08013) / Lv6 (D08011)
      self.scene = [
        mkC('B05039', 'mat#1'),
        mkC('D08009', 'l5a'), mkC('D08010', 'l5b'),
        mkC('D08022', 'l7'),
        mkC('D08013', 'l4'), mkC('D08011', 'l6'),
      ];
      // 相手現場にも Lv7 (l7opp) + Lv6 decoy (l6opp) — rules/15「どちらの現場でも選べる」を検証
      opp.scene = [mkC('D08022', 'l7opp'), mkC('D08011', 'l6opp')];
      self.deck = ['D08005']; // 推理 LP1 で 1 枚証拠化
      gs.pendingEffects = [];
      gs.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    });

    const before = {
      l5a: await apOf(page, 'l5a'), l5b: await apOf(page, 'l5b'),
      l7: await apOf(page, 'l7'), l7opp: await apOf(page, 'l7opp'),
      l4: await apOf(page, 'l4'), l6: await apOf(page, 'l6'), l6opp: await apOf(page, 'l6opp'),
    };

    await dispatchAction(page, { type: 'reasoning', uid: 'mat#1' });

    // pick#1: レベル5のキャラを2枚まで (候補=Lv5 のみ, Lv4/Lv6 decoy は除外)
    const p1 = await getPendingEffectPick(page);
    expect(p1, 'pick#1 が surface').not.toBeNull();
    expect(p1!.atomVerb, 'atomVerb=charModifyAP').toBe('charModifyAP');
    expect(p1!.nMax, 'レベル5は「2枚まで」= max 2').toBe(2);
    const p1uids = p1!.candidates.map((c) => c.uid).sort();
    expect(p1uids, '候補は Lv5 の l5a/l5b のみ (Lv4/Lv6 decoy 除外)').toEqual(['l5a', 'l5b']);

    await dispatchAction(page, { type: 'effectPickResolve', pickedUid: 'l5a', pickedUids: ['l5a', 'l5b'] });

    // pick#2: レベル7のキャラを1枚まで (候補=Lv7 のみ、両現場 = l7(self)+l7opp(opp))
    const p2 = await getPendingEffectPick(page);
    expect(p2, 'pick#2 (Lv7) が surface').not.toBeNull();
    expect(p2!.nMax, 'レベル7は「1枚まで」= max 1').toBe(1);
    expect(p2!.candidates.map((c) => c.uid).sort(), '候補は Lv7 の l7(self)+l7opp(opp) (両現場, Lv6 decoy 除外)').toEqual(['l7', 'l7opp']);

    // 1枚まで → l7 (self) のみ選択 (l7opp は候補だが未選択)
    await dispatchAction(page, { type: 'effectPickResolve', pickedUid: 'l7', pickedUids: ['l7'] });

    expect((await apOf(page, 'l5a')) - before.l5a, 'Lv5(A) +1000').toBe(1000);
    expect((await apOf(page, 'l5b')) - before.l5b, 'Lv5(B) +1000 (multi-target 2枚目)').toBe(1000);
    expect((await apOf(page, 'l7')) - before.l7, 'Lv7(self) +1000').toBe(1000);
    expect((await apOf(page, 'l7opp')) - before.l7opp, 'Lv7(opp) は候補だが未選択 = 不変').toBe(0);
    expect((await apOf(page, 'l4')) - before.l4, 'Lv4 decoy 不変').toBe(0);
    expect((await apOf(page, 'l6')) - before.l6, 'Lv6 decoy(self) 不変').toBe(0);
    expect((await apOf(page, 'l6opp')) - before.l6opp, 'Lv6 decoy(opp) 不変').toBe(0);
    expect(errors).toEqual([]);
  });

  test('B03096: 推理→相手デッキ上=Lv8(D08003) で自分1ドロー + その札は相手デッキ下へ', async ({ page }) => {
    const { errors } = await setupGamePage(page);
    await setHumanSelf(page);
    await buildGameState(page, (gs: AnyState) => {
      const mkC = (cardId: string, uid: string, state = 'active') => ({ cardId, uid, state, isNamed: false, enterOrder: 1, enterOrderThisTurn: 1, setCards: [], stackedCards: 0, keywordOverrides: { granted: [], disabledOriginal: false }, apOverride: null, lpOverride: null, turnEffects: { contactImmune: false, removeOnTurnEnd: false }, declaredUseCount: {} });
      const self = (gs.players as AnyState).self as AnyState;
      const opp = (gs.players as AnyState).opp as AnyState;
      self.partner = { cardId: 'D08001', state: 'active', location: 'partner-area' };
      self.case = { cardId: 'D08026', status: '事件編', requiredEvidence: 7, colors: ['黄'], declaredUseCount: {} };
      self.hand = []; self.evidence = []; self.remove = []; self.file = [];
      self.scene = [mkC('B03096', 'mgr#1')];
      self.deck = ['D08005', 'D08013']; // LP1 証拠化 → 発見ドローで D08013
      // opp deck top = Lv8 (D08003 江戸川コナン Lv8) = 発見成立
      opp.deck = ['D08003', 'D08009', 'D08010'];
      gs.pendingEffects = [];
      gs.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    });

    await dispatchAction(page, { type: 'reasoning', uid: 'mgr#1' });

    const after = await getGameState(page);
    const self = after.players.self as { hand: string[] };
    const opp = after.players.opp as { deck: string[] };
    expect(self.hand, 'Lv8発見で自分が1ドロー (D08013)').toContain('D08013');
    expect(opp.deck[0], '公開した Lv8 (D08003) は相手デッキ上に残らない').not.toBe('D08003');
    expect(opp.deck[opp.deck.length - 1], '公開した Lv8 は相手デッキ下へ (捜査1)').toBe('D08003');
    expect(errors).toEqual([]);
  });

  test('B03096: 相手デッキ上=Lv7(<8) → ドローなし / その札は相手デッキ下へ', async ({ page }) => {
    const { errors } = await setupGamePage(page);
    await setHumanSelf(page);
    await buildGameState(page, (gs: AnyState) => {
      const mkC = (cardId: string, uid: string, state = 'active') => ({ cardId, uid, state, isNamed: false, enterOrder: 1, enterOrderThisTurn: 1, setCards: [], stackedCards: 0, keywordOverrides: { granted: [], disabledOriginal: false }, apOverride: null, lpOverride: null, turnEffects: { contactImmune: false, removeOnTurnEnd: false }, declaredUseCount: {} });
      const self = (gs.players as AnyState).self as AnyState;
      const opp = (gs.players as AnyState).opp as AnyState;
      self.partner = { cardId: 'D08001', state: 'active', location: 'partner-area' };
      self.case = { cardId: 'D08026', status: '事件編', requiredEvidence: 7, colors: ['黄'], declaredUseCount: {} };
      self.hand = []; self.evidence = []; self.remove = []; self.file = [];
      self.scene = [mkC('B03096', 'mgr#1')];
      self.deck = ['D08005', 'D08013']; // D08013 は引かれないはず
      // opp deck top = Lv7 (D08022 江戸川コナン Lv7) <8 = 発見せず
      opp.deck = ['D08022', 'D08009', 'D08010'];
      gs.pendingEffects = [];
      gs.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    });

    await dispatchAction(page, { type: 'reasoning', uid: 'mgr#1' });

    const after = await getGameState(page);
    const self = after.players.self as { hand: string[] };
    const opp = after.players.opp as { deck: string[] };
    expect(self.hand, 'Lv8未満 → ドローなし').not.toContain('D08013');
    expect(opp.deck[0], '公開した Lv7 は相手デッキ上に残らない').not.toBe('D08022');
    expect(opp.deck[opp.deck.length - 1], '公開した Lv7 は相手デッキ下へ (捜査1)').toBe('D08022');
    expect(errors).toEqual([]);
  });
});
