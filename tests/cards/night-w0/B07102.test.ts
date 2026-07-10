// tests/cards/night-w0/B07102 — 犯人 (DEFER 解禁 GREEN probe, engine変更0)
//   a1: 【登場時】手札から【カットイン】を持つ【黒】のカードを好きな枚数リムーブし、リムーブした枚数と
//        同じ枚数のカードを引く。
//     chain[ discard{pick hand, filter{color:黒, cutinTextIncludes:''}, n{min:0,max:99}, bind:'$discarded'},
//            draw{ n:{dyn:'$bound.$discarded.count'} } ]。
//   検証: (1) cutin黒 のみ候補 (cutin非黒 / 非cutin黒 は decoy 負例) (2) リムーブ枚数 = draw 枚数
//        (3) 0枚可 (min:0) → draw 0 (4) 該当0枚 → pick 出ず draw 0
//        (5) 条件で無効な cutin も候補 (Q&A: 所持は印字判定) (6) owner='opp' 逆側 pin (BUG-174)。
//   production dispatch: event.emit('enter') + runAllUntilEmpty。human pick = _drainPendingEffectPickSide +
//        applyPickAndContinuation / AI pick = drainAiEffectPicks。
// rules: 14 (refresh) / 15 (「好きな枚数」= 0可) / 17 (【カットイン】所持は印字判定, Q&A) / 20 (色)
import { describe, it, expect, beforeEach } from 'vitest';
import { createEmptyGameState } from '@/engine/state-factory';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { mutate } from '@/engine/mutate/index';
import { event } from '@/engine/event/index';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { _drainPendingEffectPickSide, _clearPendingEffectPickQueue } from '@/engine/effect/pending-state';
import { applyPickAndContinuation, applyPickSkipAndContinuation, drainAiEffectPicks } from '@/engine/effect/apply-pick';
import { B07102 } from '@/cards/ct-p07/B07102';
import type { AbilityDef, CardDef, GameState } from '@/engine/types';

const cutinAbility = (over: Partial<AbilityDef> = {}): AbilityDef => ({
  id: 'cut',
  type: 'triggered',
  scope: 'on-hand',
  trigger: { hook: 'effect:declared', optional: true, selfOnly: true },
  effect: { kind: 'atom', verb: 'charModifyAP', args: { uid: '$contact.byUid', delta: 1000, scope: 'contact' } },
  description: '【カットイン】AP＋1000',
  ...over,
});

function mkChar(id: string, over: Partial<CardDef> = {}): CardDef {
  return {
    id, no: id, kind: 'character', names: [id], colors: ['黒'], level: 3, ap: 3000, lp: 1,
    traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [], ...over,
  };
}
const PRED: CardDef = { id: 'PRED', no: 'PRED', kind: 'partner', names: ['P黒'], colors: ['黒'], level: 0, ap: 0, lp: 3, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [] };

// cutin 黒 (正例) ×3
const CK1 = mkChar('CK1', { colors: ['黒'], abilities: [cutinAbility()] });
const CK2 = mkChar('CK2', { colors: ['黒'], abilities: [cutinAbility()] });
const CK3 = mkChar('CK3', { colors: ['黒'], abilities: [cutinAbility()] });
// decoy: cutin だが非黒 (色不一致)
const CR = mkChar('CR', { colors: ['赤'], abilities: [cutinAbility()] });
// decoy: 黒 だが cutin 非所持
const PK = mkChar('PK', { colors: ['黒'], abilities: [] });
// Q&A: 条件で無効な cutin (【パートナー青】条件付・partner は黒で不成立) も印字所持 → 候補 (黒)
const CKC = mkChar('CKC', {
  colors: ['黒'],
  abilities: [cutinAbility({ id: 'cutc', condition: { kind: 'partnerColor', color: '青' } })],
});
const DECK6 = ['D1', 'D2', 'D3', 'D4', 'D5', 'D6'];
const FIXTURES: CardDef[] = [
  PRED, B07102, CK1, CK2, CK3, CR, PK, CKC,
  ...DECK6.map((id) => mkChar(id)),
];

type G = { __humanPlayerSide?: 'self' | 'opp' | null };
const setHuman = (v: 'self' | 'opp' | null) => { (globalThis as G).__humanPlayerSide = v; };

function base(): GameState {
  const s = createEmptyGameState();
  s.turn = { number: 3, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
  s.players.self.partner = { cardId: 'PRED', state: 'active', location: 'partner-area' } as never;
  s.players.opp.partner = { cardId: 'PRED', state: 'active', location: 'partner-area' } as never;
  return s;
}

function emitEnter(s: GameState, cardId: string, side: 'self' | 'opp' = 'self'): string {
  const c = mutate.scene.enter(s, side, cardId, { named: true, viaEffect: false });
  event.emit(
    s, 'enter',
    { uid: c.uid, viaEffect: false, enterOrder: c.enterOrder, enterOrderThisTurn: c.enterOrderThisTurn },
    { player: side, cardId, uid: c.uid },
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

describe('B07102 a1 — 登場時: cutin黒 を好きな枚数リムーブ → 同数 draw (human pick)', () => {
  it('候補 = cutin黒 のみ (cutin非黒 CR / 非cutin黒 PK は decoy 負例)', () => {
    const s = base();
    s.players.self.hand = ['CK1', 'CK2', 'CR', 'PK'];
    s.players.self.deck = [...DECK6];
    emitEnter(s, 'B07102');
    const pick = _drainPendingEffectPickSide();
    expect(pick, 'discard pick が surface').toBeTruthy();
    expect(pick!.nMin, '「好きな枚数」= 0 可').toBe(0);
    const cands = pick!.candidates as Array<{ uid: string; cardId: string }>;
    expect(cands.map((c) => c.cardId).sort(), '候補は cutin黒 の CK1/CK2 のみ').toEqual(['CK1', 'CK2']);
    expect(cands.map((c) => c.cardId), 'cutin非黒 CR は候補外 (色不一致)').not.toContain('CR');
    expect(cands.map((c) => c.cardId), '非cutin黒 PK は候補外 (cutin非所持)').not.toContain('PK');
  });

  it('2枚リムーブ → 2枚 draw (リムーブ枚数 = draw 枚数)', () => {
    const s = base();
    s.players.self.hand = ['CK1', 'CK2', 'CK3', 'PK'];
    s.players.self.deck = [...DECK6];
    emitEnter(s, 'B07102');
    const pick = _drainPendingEffectPickSide();
    const cands = pick!.candidates as Array<{ uid: string; cardId: string }>;
    const chosen = ['CK1', 'CK3'];
    const chosenUids = chosen.map((id) => cands.find((c) => c.cardId === id)!.uid);
    applyPickAndContinuation(s, pick!, chosenUids[0]!, chosenUids);
    runAllUntilEmpty(s);
    expect(s.players.self.remove.sort(), 'リムーブへ CK1/CK3').toEqual(['CK1', 'CK3']);
    expect(s.players.self.hand, 'リムーブ後の手札 = CK2/PK + draw 2 (D1,D2)').toEqual(['CK2', 'PK', 'D1', 'D2']);
    expect(s.players.self.deck, 'デッキ上2枚 draw 済').toEqual(['D3', 'D4', 'D5', 'D6']);
  });

  it('0枚リムーブ (min:0) → draw 0 (手札・デッキ不変, リムーブ空)', () => {
    const s = base();
    s.players.self.hand = ['CK1', 'CK2'];
    s.players.self.deck = [...DECK6];
    emitEnter(s, 'B07102');
    const pick = _drainPendingEffectPickSide();
    applyPickSkipAndContinuation(s, pick!, false); // 0枚選択 (chain-origin decline: discard 不実行 → draw remainder のみ)
    runAllUntilEmpty(s);
    expect(s.players.self.remove.length, 'リムーブ0').toBe(0);
    expect(s.players.self.hand.sort(), '手札不変').toEqual(['CK1', 'CK2']);
    expect(s.players.self.deck, 'デッキ不変 (draw 0)').toEqual([...DECK6]);
  });

  it('該当0枚 (cutin黒 手札に無し) → pick 出ず draw 0', () => {
    const s = base();
    s.players.self.hand = ['CR', 'PK']; // cutin非黒 / 非cutin黒 のみ
    s.players.self.deck = [...DECK6];
    emitEnter(s, 'B07102');
    expect(_drainPendingEffectPickSide(), '候補0 → pick 出ない').toBeNull();
    expect(s.players.self.hand.sort(), '手札不変').toEqual(['CR', 'PK']);
    expect(s.players.self.deck, 'デッキ不変').toEqual([...DECK6]);
  });

  it('Q&A: 条件で効果が無効な cutin黒 (CKC 【解決編】条件付) も候補 = 印字所持で判定', () => {
    const s = base();
    s.players.self.hand = ['CKC', 'PK'];
    s.players.self.deck = [...DECK6];
    emitEnter(s, 'B07102');
    const pick = _drainPendingEffectPickSide();
    const cands = pick!.candidates as Array<{ cardId: string }>;
    expect(cands.map((c) => c.cardId), '条件不成立でも cutin 印字所持 → 候補').toContain('CKC');
    expect(cands.map((c) => c.cardId), 'PK は候補外').not.toContain('PK');
  });
});

describe('B07102 a1 — owner=opp 逆側 pin (BUG-174, AI 経路)', () => {
  it('opp 側に登場 → opp の手札から cutin黒 全リムーブ → opp が同数 draw (self は不変)', () => {
    setHuman(null); // AI 経路 (greedy 全取り)
    const s = base();
    s.players.opp.hand = ['CK1', 'CK2', 'PK']; // cutin黒 ×2 + decoy
    s.players.opp.deck = [...DECK6];
    s.players.self.hand = ['CK3']; // self 手札は触られない
    s.players.self.deck = ['D1'];
    emitEnter(s, 'B07102', 'opp');
    drainAiEffectPicks(s);
    runAllUntilEmpty(s);
    expect(s.players.opp.remove.sort(), 'opp リムーブ = cutin黒 2枚 (greedy 全取り)').toEqual(['CK1', 'CK2']);
    expect(s.players.opp.hand.sort(), 'opp 手札 = PK + draw 2 (D1,D2)').toEqual(['D1', 'D2', 'PK']);
    expect(s.players.self.hand, 'self 手札は不変 (逆側 pin)').toEqual(['CK3']);
    expect(s.players.self.deck, 'self デッキ不変').toEqual(['D1']);
  });
});
