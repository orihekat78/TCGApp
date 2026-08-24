// tests/cards/m2latter-hand-cycle — M2後半 batch カード probe (B04048 羽田秀𠮷 / B06003 毛利蘭＆江戸川コナン)
//   B04048 a1: 【パートナー赤】【登場時】手札7枚まで draw → 引いた枚数と同じ数を手札からシャッフルしてデッキ下
//     (chain + drawUpToHandSize bind + handToDeckBottom n:{dyn:'$bound.$drawn.count'} + shuffleMoved)。
//   B04048 a2: declareName → deckRevealUntil maxN:2 filter cardName dyn → handAddFromDeck → deckToBottomBound。
//   B06003 a1: cost selfLpDeltaTurn(-2) が実効 LP に乗る + sceneSetState sleep pick (side either)。
//   B06003 a2: 宣言条件 and[sceneHas nMin:3, sceneLpSum max:2] gate + draw1 → 手札5枚以上なら discard1。
// production dispatch 経由 (event.emit enter / activateDeclaredAbility + runAllUntilEmpty)。
// rules: 14 (refresh) / 15 (「まで」=0可・either) / 17 (パートナー色 = 持っていない扱い) /
//        19 (LP 下限なし・複数名) / 21 (コスト) / 25 (逐次評価) / 26 (deck-look)
import { describe, it, expect, beforeEach } from 'vitest';
import { createEmptyGameState } from '@/engine/state-factory';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { mutate } from '@/engine/mutate/index';
import { event } from '@/engine/event/index';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { _drainPendingEffectPickSide, _clearPendingEffectPickQueue } from '@/engine/effect/pending-state';
import { applyPickAndContinuation, drainAiEffectPicks } from '@/engine/effect/apply-pick';
import { canDeclaredAbility } from '@/engine/flow/main/declared-ability';
import { activateDeclaredAbility } from '@/engine/flow/main/ability-activate';
import { char as charRead } from '@/engine/read/char';
import { B04048 } from '@/cards/ct-p04/B04048';
import { B06003 } from '@/cards/ct-p06/B06003';
import type { CardDef, GameState } from '@/engine/types';

function mkChar(id: string, over: Partial<CardDef> = {}): CardDef {
  return {
    id, no: id, kind: 'character', names: [id], colors: ['赤'], level: 3, ap: 3000, lp: 1,
    traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [], ...over,
  };
}
const PRED: CardDef = { id: 'PRED', no: 'PRED', kind: 'partner', names: ['P赤'], colors: ['赤'], level: 0, ap: 0, lp: 3, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [] };
const PBLUE: CardDef = { id: 'PBLUE', no: 'PBLUE', kind: 'partner', names: ['P青'], colors: ['青'], level: 0, ap: 0, lp: 3, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [] };
const DECK10 = ['D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'D8', 'D9', 'D10'];
const FIXTURES: CardDef[] = [
  PRED, PBLUE, B04048, B06003,
  mkChar('H1'), mkChar('TGT', { names: ['ターゲット'] }), mkChar('MOB1'),
  mkChar('LP0A', { lp: 0 }), mkChar('LP0B', { lp: 0 }), mkChar('LP1', { lp: 1 }),
  ...DECK10.map((id) => mkChar(id)),
];

type G = { __humanPlayerSide?: 'self' | 'opp' | null };
const setHuman = (v: 'self' | 'opp' | null) => { (globalThis as G).__humanPlayerSide = v; };

function base(partnerId: string): GameState {
  const s = createEmptyGameState();
  s.turn = { number: 3, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
  s.players.self.partner = { cardId: partnerId, state: 'active', location: 'partner-area' } as never;
  return s;
}

function emitEnter(s: GameState, cardId: string): string {
  const c = mutate.scene.enter(s, 'self', cardId, { named: true, viaEffect: false });
  event.emit(
    s, 'enter',
    { uid: c.uid, viaEffect: false, enterOrder: c.enterOrder, enterOrderThisTurn: c.enterOrderThisTurn },
    { player: 'self', cardId, uid: c.uid },
  );
  runAllUntilEmpty(s);
  return c.uid;
}

beforeEach(() => {
  event._resetRegistry(); // handler 累積防止 (miniwave3/4 manual-probes 慣行)
  resetDefRegistry();
  _resetTriggeredRegistered();
  _resetUidCounter();
  _clearPendingEffectPickQueue();
  for (const d of FIXTURES) registerCardDef(d);
  registerTriggeredListener();
  setHuman('self');
});

// ============ B04048 a1 — 登場時: 手札7枚まで draw → 引いた枚数をシャッフルしてデッキ下 ============
describe('B04048 a1 — drawUpToHandSize bind → handToDeckBottom dyn (production enter dispatch)', () => {
  it('手札1 + デッキ10 → 6枚 draw → pick nMin=nMax=6 (dyn 解決) → 選択6枚がデッキ下 (シャッフル集合一致)', () => {
    const s = base('PRED');
    s.players.self.hand = ['H1'];
    s.players.self.deck = [...DECK10];
    emitEnter(s, 'B04048');
    expect(s.players.self.hand.length, 'draw 6 → 手札7').toBe(7);
    const pick = _drainPendingEffectPickSide();
    expect(pick, 'handToDeckBottom pick が surface').toBeTruthy();
    expect(pick!.nMin, '「引いた枚数と同じ数」= min 6').toBe(6);
    expect(pick!.nMax, '「引いた枚数と同じ数」= max 6').toBe(6);
    const cands = pick!.candidates as Array<{ uid: string; cardId: string }>;
    expect(cands.map((c) => c.cardId).sort(), '候補 = 手札7枚全部 (引いたカード以外も選べる — Q&A 自分が選択)').toEqual(
      ['D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'H1'].sort(),
    );
    const chosen = ['D1', 'D2', 'D3', 'D4', 'D5', 'H1']; // 引いたカード以外 (H1) を混ぜて選択
    const chosenUids = chosen.map((id) => cands.find((c) => c.cardId === id)!.uid); // hand pick uid = cardId#idx
    applyPickAndContinuation(s, pick!, chosenUids[0]!, chosenUids);
    runAllUntilEmpty(s);
    expect(s.players.self.hand, '残り手札 = D6 のみ').toEqual(['D6']);
    expect(s.players.self.deck.length, 'デッキ = 4 + 6 = 10').toBe(10);
    expect(s.players.self.deck.slice(0, 4), 'デッキ上 4 枚は不変').toEqual(['D7', 'D8', 'D9', 'D10']);
    expect([...s.players.self.deck.slice(4)].sort(), '移動 6 枚がデッキ下 (順序は無作為 = 集合一致)').toEqual(
      [...chosen].sort(),
    );
  });
  it('手札7枚以上 → 1枚も引かず実質何も起こらない (公式Q&A)', () => {
    const s = base('PRED');
    s.players.self.hand = ['D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7'];
    s.players.self.deck = ['D8', 'D9'];
    emitEnter(s, 'B04048');
    expect(_drainPendingEffectPickSide(), 'pick は出ない (dyn-n-0 no-op)').toBeNull();
    expect(s.players.self.hand.length, '手札不変').toBe(7);
    expect(s.players.self.deck, 'デッキ不変').toEqual(['D8', 'D9']);
  });
  it('【パートナー赤】不成立 (青パートナー) → 発動しない (rules/17 持っていない扱い)', () => {
    const s = base('PBLUE');
    s.players.self.hand = ['H1'];
    s.players.self.deck = [...DECK10];
    emitEnter(s, 'B04048');
    expect(_drainPendingEffectPickSide()).toBeNull();
    expect(s.players.self.hand, '手札不変').toEqual(['H1']);
    expect(s.players.self.deck.length, 'デッキ不変').toBe(10);
  });
});

// ============ B04048 a2 — declareName → 上2枚見て指定名を手札へ、残りデッキ下 ============
describe('B04048 a2 — 宣言 (declareName + deckRevealUntil filter dyn cardName)', () => {
  it('宣言名一致 (上2枚の中): 該当1枚を手札へ、残り1枚はデッキ下 (AI 経路)', () => {
    setHuman(null);
    const s = base('PRED');
    const me = mutate.scene.enter(s, 'self', 'B04048', {});
    s.players.self.deck = ['MOB1', 'TGT', 'D1', 'D2'];
    activateDeclaredAbility(s, me.uid, 'a2', { declaredName: 'ターゲット' });
    runAllUntilEmpty(s);
    drainAiEffectPicks(s);
    runAllUntilEmpty(s);
    expect(s.players.self.hand, '指定名 TGT を手札へ').toContain('TGT');
    expect(s.players.self.deck, 'TGT はデッキから抜ける').not.toContain('TGT');
    expect(s.players.self.deck[s.players.self.deck.length - 1], '残り MOB1 はデッキ下へ').toBe('MOB1');
    expect(s.players.self.deck.slice(0, 2), '3枚目以降は見ない (maxN:2)').toEqual(['D1', 'D2']);
  });
  it('宣言名不一致: 何も加えず 2 枚ともデッキ下へ (公式Q&A 加えないことも可能 = 0枚可)', () => {
    setHuman(null);
    const s = base('PRED');
    const me = mutate.scene.enter(s, 'self', 'B04048', {});
    s.players.self.deck = ['MOB1', 'D1', 'D2', 'D3'];
    activateDeclaredAbility(s, me.uid, 'a2', { declaredName: 'ターゲット' });
    runAllUntilEmpty(s);
    drainAiEffectPicks(s);
    runAllUntilEmpty(s);
    expect(s.players.self.hand.length, '手札に加えない').toBe(0);
    expect(s.players.self.deck.length, 'デッキ枚数不変').toBe(4);
    expect(s.players.self.deck.slice(0, 2), '見た2枚はデッキ下へ移動').toEqual(['D2', 'D3']);
    expect([...s.players.self.deck.slice(2)].sort(), '下2枚 = 見た [MOB1, D1]').toEqual(['D1', 'MOB1']);
  });
  it('【ターン1】: 2回目は canDeclaredAbility false', () => {
    setHuman(null);
    const s = base('PRED');
    const me = mutate.scene.enter(s, 'self', 'B04048', {});
    s.players.self.deck = ['MOB1', 'D1', 'D2'];
    expect(canDeclaredAbility(s, me.uid, 'a2')).toBe(true);
    activateDeclaredAbility(s, me.uid, 'a2', { declaredName: 'ターゲット' });
    runAllUntilEmpty(s);
    drainAiEffectPicks(s);
    runAllUntilEmpty(s);
    expect(canDeclaredAbility(s, me.uid, 'a2'), '【ターン1】消費済').toBe(false);
  });
});

// ============ B06003 a1 — cost selfLpDeltaTurn(-2) + キャラ1枚まで sleep ============
describe('B06003 a1 — 宣言 (〚ターン終了時までLP-2〛コスト + sceneSetState sleep)', () => {
  it('宣言で実効 LP が 2→0 に下がり (コスト即時)、両現場から 1 枚選んでスリープ', () => {
    const s = base('PBLUE');
    const me = mutate.scene.enter(s, 'self', 'B06003', {});
    const t = mutate.scene.enter(s, 'opp', 'LP1', {});
    activateDeclaredAbility(s, me.uid, 'a1');
    expect(charRead.lp(s, me.uid), 'コスト: 実効 LP 2-2=0 (turn scope)').toBe(0);
    runAllUntilEmpty(s);
    const pick = _drainPendingEffectPickSide();
    expect(pick, 'sleep 対象 pick が surface').toBeTruthy();
    expect(pick!.nMin, '「1枚まで」= 0枚可').toBe(0);
    expect(pick!.nMax).toBe(1);
    const candUids = (pick!.candidates as Array<{ uid: string }>).map((c) => c.uid);
    expect(candUids, 'side either = 相手現場キャラも候補').toContain(t.uid);
    expect(candUids, '効果発動キャラ自身も選べる (rules/15)').toContain(me.uid);
    applyPickAndContinuation(s, pick!, t.uid, [t.uid]);
    runAllUntilEmpty(s);
    expect(s.players.opp.scene.find((c) => c.uid === t.uid)?.state, '選択キャラはスリープ').toBe('sleep');
  });
  it('LP1以下でも支払可 (公式Q&A: LP は負値になりうる、rules/19 下限なし)', () => {
    const s = base('PBLUE');
    const me = mutate.scene.enter(s, 'self', 'B06003', {});
    // 事前に LP-2 (turn) を別効果相当で当てて実効 LP 0 にしても宣言可能
    mutate.char.modifyLP(s, me.uid, -2, 'turn');
    expect(canDeclaredAbility(s, me.uid, 'a1')).toBe(true);
    activateDeclaredAbility(s, me.uid, 'a1');
    expect(charRead.lp(s, me.uid), '0-2 = -2 (負値可)').toBe(-2);
    runAllUntilEmpty(s);
    _drainPendingEffectPickSide();
  });
  it('【パートナー青】不成立 (赤パートナー) → 宣言不可 (rules/17)', () => {
    const s = base('PRED');
    const me = mutate.scene.enter(s, 'self', 'B06003', {});
    expect(canDeclaredAbility(s, me.uid, 'a1')).toBe(false);
  });
});

// ============ B06003 a2 — 宣言条件 (現場3枚 + LP合計≤2) + draw1 → 手札5枚以上で discard1 ============
describe('B06003 a2 — 宣言条件 gate + draw/conditional discard', () => {
  function board3(third = 'LP0B'): { s: GameState; me: { uid: string } } {
    const s = base('PBLUE');
    const me = mutate.scene.enter(s, 'self', 'B06003', {}); // LP2
    mutate.scene.enter(s, 'self', 'LP0A', {});
    mutate.scene.enter(s, 'self', third, {});
    return { s, me };
  }
  it('gate: 3枚 + 合計 2 (2+0+0) ≤2 → 宣言可', () => {
    const { s, me } = board3('LP0B');
    expect(canDeclaredAbility(s, me.uid, 'a2')).toBe(true);
  });
  it('gate: 現場2枚 → 不可 (3枚以上が必要)', () => {
    const s = base('PBLUE');
    const me = mutate.scene.enter(s, 'self', 'B06003', {});
    mutate.scene.enter(s, 'self', 'LP0A', {});
    expect(canDeclaredAbility(s, me.uid, 'a2')).toBe(false);
  });
  it('gate: 3枚でも合計 3 (2+0+1) > 2 → 不可', () => {
    const { s, me } = board3('LP1');
    expect(canDeclaredAbility(s, me.uid, 'a2')).toBe(false);
  });
  it('効果: 手札4 → draw で 5 → 「5枚以上」成立 → discard pick (draw 後の逐次評価 rules/25)', () => {
    const { s, me } = board3('LP0B');
    s.players.self.hand = ['D1', 'D2', 'D3', 'D4'];
    s.players.self.deck = ['D5', 'D6'];
    activateDeclaredAbility(s, me.uid, 'a2');
    runAllUntilEmpty(s);
    expect(s.players.self.hand.length, 'draw 1 → 手札5').toBe(5);
    const pick = _drainPendingEffectPickSide();
    expect(pick, 'discard pick が surface').toBeTruthy();
    expect(pick!.nMin).toBe(1);
    expect(pick!.nMax).toBe(1);
    const d1 = (pick!.candidates as Array<{ uid: string; cardId: string }>).find((c) => c.cardId === 'D1')!;
    applyPickAndContinuation(s, pick!, d1.uid, [d1.uid]);
    runAllUntilEmpty(s);
    expect(s.players.self.hand.length, 'discard 後 手札4').toBe(4);
    expect(s.players.self.remove, 'リムーブへ').toContain('D1');
  });
  it('効果: 手札3 → draw で 4 < 5 → discard しない', () => {
    const { s, me } = board3('LP0B');
    s.players.self.hand = ['D1', 'D2', 'D3'];
    s.players.self.deck = ['D5', 'D6'];
    activateDeclaredAbility(s, me.uid, 'a2');
    runAllUntilEmpty(s);
    expect(_drainPendingEffectPickSide(), 'discard pick は出ない').toBeNull();
    expect(s.players.self.hand.length, '手札4のまま').toBe(4);
    expect(s.players.self.remove.length).toBe(0);
  });
});
