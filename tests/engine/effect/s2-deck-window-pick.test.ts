// S2 deck cluster (2026-07-10): B01022「上から6枚見て lv4以下[少年探偵団] 2枚まで登場、残りシャッフルしてデッキ下」。
//   E1: atomDeckRevealUntil の bindings entry に index (reveal 時点の deck 位置) を同梱 — 重複 cardId 区別。
//   E2/E3: TargetQuery.fromGroupCards — pick 母集合を bound card 集合 (player/index 一致) に限定。
//       fromGroup (uid/char 用) の card-kind 並列版。binding 不在/空/index 欠落 = fail-closed 候補0。
//   E4: sceneEnter cardIds-multi deck-splice の stale-bind prune — 登場で deck を離れた カードの
//       bound entry を 1 occurrence ずつ除去 (deep copy 誤 splice 防止、deckToBottomBound 防御)。
// rules: 15 (「〜枚まで」=0可) / 26 (見ている間はデッキ扱い) / 20 (スイッチ)。
// 設計 = .claude/specs/miniwave5-deck-reveal-grounding.md P1 節 (Route B)。
import { describe, it, expect, beforeEach } from 'vitest';
import { createEmptyGameState } from '@/engine/state-factory';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { mutate } from '@/engine/mutate/index';
import { runAtom } from '@/engine/effect/atom-handlers';
import { candidates } from '@/engine/target/candidates';
import { cardOccurrenceWitness } from '@/engine/target/card-occurrence';
import { _resetUidCounter } from '@/engine/mutate/scene';
import type { CardDef, GameState, EffectCtx, Candidate, TargetingRef } from '@/engine/types';

const HOST: CardDef = { id: 'HOST', no: 'HOST', kind: 'character', names: ['主'], colors: ['青'], level: 1, ap: 1000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [] };
// 少年探偵団 lv4 以下 (pick 対象) — 同 cardId 重複ケース用
const DT1: CardDef = { id: 'DT1', no: 'DT1', kind: 'character', names: ['探偵団A'], colors: ['青'], level: 3, ap: 2000, lp: 1, traits: ['少年探偵団'], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [] };
const DT2: CardDef = { id: 'DT2', no: 'DT2', kind: 'character', names: ['探偵団B'], colors: ['青'], level: 4, ap: 2000, lp: 1, traits: ['少年探偵団'], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [] };
// lv5 の少年探偵団 (levelMax:4 で除外される decoy)
const DT5: CardDef = { id: 'DT5', no: 'DT5', kind: 'character', names: ['探偵団高Lv'], colors: ['青'], level: 5, ap: 4000, lp: 1, traits: ['少年探偵団'], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [] };
// 特徴なしキャラ (trait filter 除外 decoy)
const NX: CardDef = { id: 'NX', no: 'NX', kind: 'character', names: ['無関係'], colors: ['赤'], level: 2, ap: 2000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [] };
const EV: CardDef = { id: 'EV', no: 'EV', kind: 'event', names: ['イベ'], colors: ['青'], level: 1, rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [] } as unknown as CardDef;

function base(): GameState {
  const s = createEmptyGameState();
  s.turn = { number: 3, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
  return s;
}
function ctxFor(s: GameState): EffectCtx {
  const c = mutate.scene.enter(s, 'self', 'HOST', {});
  return { source: { player: 'self', uid: c.uid, cardId: 'HOST' }, bindings: {}, dyn: {} } as unknown as EffectCtx;
}
beforeEach(() => {
  resetDefRegistry(); _resetUidCounter();
  registerCardDef(HOST); registerCardDef(DT1); registerCardDef(DT2); registerCardDef(DT5); registerCardDef(NX); registerCardDef(EV);
  (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = null;
});

const asCards = (arr: Candidate[] | undefined): Array<{ cardId?: string; index?: number }> =>
  (arr ?? []) as unknown as Array<{ cardId?: string; index?: number }>;

describe('E1: deckRevealUntil bindings entry index 同梱', () => {
  it('top 走査 maxN:6 bind-only → index 0..5 が deck 位置と 1:1', () => {
    const s = base(); const ctx = ctxFor(s);
    s.players.self.deck = ['DT1', 'NX', 'DT1', 'EV', 'DT2', 'NX', 'DT1'];
    runAtom(s, 'deckRevealUntil' as never, { player: 'self', maxN: 6, bind: '$revealed' }, ctx);
    const b = asCards((ctx.bindings as Record<string, Candidate[]>)['$revealed']);
    expect(b.map(c => c.cardId)).toEqual(['DT1', 'NX', 'DT1', 'EV', 'DT2', 'NX']);
    expect(b.map(c => c.index), '重複 cardId (DT1×2) を deck 位置で区別').toEqual([0, 1, 2, 3, 4, 5]);
  });
  it('fromBottom 走査 → index は deck 末尾側の実位置', () => {
    const s = base(); const ctx = ctxFor(s);
    s.players.self.deck = ['NX', 'DT1', 'DT2']; // 底から DT2(idx2), DT1(idx1)
    runAtom(s, 'deckRevealUntil' as never, { player: 'self', fromBottom: true, maxN: 2, bind: '$revealed' }, ctx);
    const b = asCards((ctx.bindings as Record<string, Candidate[]>)['$revealed']);
    expect(b.map(c => c.cardId)).toEqual(['DT2', 'DT1']);
    expect(b.map(c => c.index)).toEqual([2, 1]);
  });
  it('bindMatch ペア時の matched 除外でも index が並行維持 (indexOf 再利用しない)', () => {
    const s = base(); const ctx = ctxFor(s);
    s.players.self.deck = ['NX', 'DT1', 'NX', 'DT1']; // maxN:4、filter=trait → 最初の DT1(idx1) が matched
    runAtom(s, 'deckRevealUntil' as never, { player: 'self', maxN: 4, filter: { trait: '少年探偵団' }, bind: '$revealed', bindMatch: '$matched' }, ctx);
    const rest = asCards((ctx.bindings as Record<string, Candidate[]>)['$revealed']);
    const m = asCards((ctx.bindings as Record<string, Candidate[]>)['$matched']);
    expect(m.map(c => c.index), 'matched は idx1 の DT1').toEqual([1]);
    expect(rest.map(c => c.cardId)).toEqual(['NX', 'NX', 'DT1']);
    expect(rest.map(c => c.index), '残 DT1 は idx3 (idx1 と取り違えない)').toEqual([0, 2, 3]);
  });
});

describe('E2/E3: TargetQuery.fromGroupCards (deck window pick 母集合)', () => {
  function windowedPick(s: GameState, ctx: EffectCtx): Candidate[] {
    const ref: TargetingRef = {
      kind: 'pick',
      query: {
        area: 'deck', side: 'self',
        filter: { kind: 'character', trait: '少年探偵団', levelMax: 4 },
        fromGroupCards: '$revealed',
      },
      n: { min: 0, max: 2 },
      chooser: 'owner',
    } as TargetingRef;
    return candidates(s, ref, ctx);
  }
  it('window 内の filter 一致のみ候補化 — window 外の deep 一致 (decoy) を除外', () => {
    const s = base(); const ctx = ctxFor(s);
    // window = 上6 / idx6 の DT1 は window 外 decoy
    s.players.self.deck = ['DT1', 'NX', 'DT5', 'EV', 'DT2', 'NX', 'DT1'];
    runAtom(s, 'deckRevealUntil' as never, { player: 'self', maxN: 6, bind: '$revealed' }, ctx);
    const out = asCards(windowedPick(s, ctx));
    expect(out.map(c => `${c.cardId}#${c.index}`).sort(), 'DT1(idx0)+DT2(idx4)。DT5=lv5 除外 / NX=特徴外 / idx6 DT1=window 外').toEqual(['DT1#0', 'DT2#4']);
  });
  it('window 内の同 cardId 重複は index で区別され 2 候補になる', () => {
    const s = base(); const ctx = ctxFor(s);
    s.players.self.deck = ['DT1', 'DT1', 'NX', 'EV', 'NX', 'NX', 'DT1'];
    runAtom(s, 'deckRevealUntil' as never, { player: 'self', maxN: 6, bind: '$revealed' }, ctx);
    const out = asCards(windowedPick(s, ctx));
    expect(out.map(c => `${c.cardId}#${c.index}`).sort()).toEqual(['DT1#0', 'DT1#1']);
  });
  it('binding 不在 / 空 → 候補 0 (fail-closed)', () => {
    const s = base(); const ctx = ctxFor(s);
    s.players.self.deck = ['DT1', 'DT2'];
    expect(windowedPick(s, ctx).length, 'binding 不在').toBe(0);
    (ctx.bindings as Record<string, Candidate[]>)['$revealed'] = [];
    expect(windowedPick(s, ctx).length, 'binding 空').toBe(0);
  });
  it('index を欠く bound entry は照合対象にならない (fail-closed)', () => {
    const s = base(); const ctx = ctxFor(s);
    s.players.self.deck = ['DT1', 'DT2'];
    (ctx.bindings as Record<string, Candidate[]>)['$revealed'] = [
      { kind: 'card', cardId: 'DT1', area: 'deck', player: 'self' } as Candidate, // index 無し (旧 producer)
    ];
    expect(windowedPick(s, ctx).length).toBe(0);
  });
});

describe('E4: sceneEnter cardIds-multi deck-splice の stale-bind prune', () => {
  it('登場した cardId の bound entry を 1 occurrence ずつ除去 → deckToBottomBound が deep copy を誤 splice しない', () => {
    const s = base(); const ctx = ctxFor(s);
    // window = 上4: [DT1, DT1, NX, EV] / deck 深部 idx4 に DT1 (window 外)
    s.players.self.deck = ['DT1', 'DT1', 'NX', 'EV', 'DT1'];
    runAtom(s, 'deckRevealUntil' as never, { player: 'self', maxN: 4, bind: '$revealed' }, ctx);
    // window の DT1 を 1 枚だけ登場 (resolved cardIds 経路)
    runAtom(s, 'sceneEnter' as never, {
      player: 'self', cardIds: ['DT1'],
      target: { kind: 'pick', query: { area: 'deck', side: 'self', fromGroupCards: '$revealed' }, n: { min: 0, max: 2 }, chooser: 'owner' },
    }, ctx);
    expect(s.players.self.scene.some(c => c.cardId === 'DT1'), '登場済').toBe(true);
    expect(s.players.self.deck, 'window 先頭の DT1 が splice 済').toEqual(['DT1', 'NX', 'EV', 'DT1']);
    const b = asCards((ctx.bindings as Record<string, Candidate[]>)['$revealed']);
    expect(b.map(c => c.cardId), '$revealed から DT1 を 1 occurrence だけ prune').toEqual(['DT1', 'NX', 'EV']);
    // 残り window 3 枚をデッキ下へ → deep DT1 (元 idx4) はデッキ上に残る
    runAtom(s, 'deckToBottomBound' as never, { player: 'self', bindKey: '$revealed' }, ctx);
    expect(s.players.self.deck.length).toBe(4);
    expect(s.players.self.deck[0], 'deep DT1 が top に残る (誤って bottom 送りされない)').toBe('DT1');
    expect(s.players.self.deck.slice(1).sort(), '残 window 3 枚が bottom').toEqual(['DT1', 'EV', 'NX']);
  });
  it('登場 0 枚 (__declined) は bindings を触らない', () => {
    const s = base(); const ctx = ctxFor(s);
    s.players.self.deck = ['DT1', 'NX'];
    runAtom(s, 'deckRevealUntil' as never, { player: 'self', maxN: 2, bind: '$revealed' }, ctx);
    runAtom(s, 'sceneEnter' as never, {
      player: 'self', cardIds: '$pick.cardIds', __declined: true,
      target: { kind: 'pick', query: { area: 'deck', side: 'self', fromGroupCards: '$revealed' }, n: { min: 0, max: 2 }, chooser: 'owner' },
    }, ctx);
    expect(asCards((ctx.bindings as Record<string, Candidate[]>)['$revealed']).length).toBe(2);
    expect(s.players.self.deck).toEqual(['DT1', 'NX']);
  });
});

describe('E5: multi sceneEnter renews exact deck authority', () => {
  it('renews the surviving window once after two physical occurrences enter', () => {
    const s = base(); const ctx = ctxFor(s);
    s.players.self.deck = ['DT1', 'DT1', 'NX', 'EV', 'DT1'];
    runAtom(s, 'deckRevealUntil' as never, { player: 'self', maxN: 4, bind: '$revealed' }, ctx);
    const beforeWitness = cardOccurrenceWitness(s, 'self', 'deck');
    const revealed = (ctx.bindings as Record<string, Candidate[]>)['$revealed'];

    runAtom(s, 'sceneEnter' as never, {
      player: 'self',
      cardIds: ['DT1', 'DT1'],
      selectedCardOccurrences: structuredClone(revealed.slice(0, 2)),
      target: {
        kind: 'pick',
        query: { area: 'deck', side: 'self', fromGroupCards: '$revealed' },
        n: { min: 0, max: 2 },
        chooser: 'owner',
      },
    }, ctx);

    const afterWitness = cardOccurrenceWitness(s, 'self', 'deck');
    const remaining = (ctx.bindings as Record<string, Candidate[]>)['$revealed'];
    expect(afterWitness).not.toBe(beforeWitness);
    expect(remaining.map(({ cardId, index }) => `${cardId}#${index}`)).toEqual(['NX#0', 'EV#1']);
    expect(remaining.every(({ occurrenceWitness }) => occurrenceWitness === afterWitness)).toBe(true);

    runAtom(s, 'deckToBottomBound' as never, { player: 'self', bindKey: '$revealed' }, ctx);
    expect(s.players.self.deck[0]).toBe('DT1');
    expect(s.players.self.deck.slice(1).sort()).toEqual(['EV', 'NX']);
  });
});
