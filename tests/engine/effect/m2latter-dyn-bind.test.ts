// M2 後半 batch (2026-07-10): handler-local dyn/bind 小粒 additive 群の TDD probe。
//   P1: atomMill n:{dyn} — 「そのカードのレベルと同じ枚数リムーブする」(PR265 風見裕也)。
//   P2: atomDrawUpToHandSize bind — 「引いた枚数」の後段参照 (B04048 羽田秀𠮷 a1)。
//   P3: atomHandToDeckBottom n:{dyn} — 「引いた枚数と同じ数の手札をデッキの下に移す」(B04048 a1)。
//   P4: atomHandToDeckBottom shuffleMoved — 「シャッフルしてデッキの下に移す」(移動群の順序無作為化、B04048 a1)。
//   P5: atomSceneEnter cardIds-multi bind — 「この効果によってキャラが5枚登場した場合」(B09019 くさるなよ！)。
// rules: 14 (mill refresh) / 15 (可能な限り) / 26。grounding = specs/grounding/{PR265,B04048,B09019}.md。
// dyn は handler-local 解決必須 (walk-literalize 罠 — chain 前段 bind は実行時確定)。
import { describe, it, expect, beforeEach } from 'vitest';
import { createEmptyGameState } from '@/engine/state-factory';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { mutate } from '@/engine/mutate/index';
import { runAtom } from '@/engine/effect/atom-handlers';
import { applyPickAndContinuation } from '@/engine/effect/apply-pick';
import { run } from '@/engine/effect/resolver';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { _drainPendingEffectPickSide, _clearPendingEffectPickQueue } from '@/engine/effect/pending-state';
import type { CardDef, GameState, EffectCtx, Candidate } from '@/engine/types';

const HOST: CardDef = { id: 'HOST', no: 'HOST', kind: 'character', names: ['主'], colors: ['赤'], level: 5, ap: 4000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [] };
const L5: CardDef = { id: 'L5', no: 'L5', kind: 'character', names: ['レ5'], colors: ['赤'], level: 5, ap: 1000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [] };
const L2: CardDef = { id: 'L2', no: 'L2', kind: 'character', names: ['レ2'], colors: ['赤'], level: 2, ap: 1000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [] };
const KID1: CardDef = { id: 'KID1', no: 'KID1', kind: 'character', names: ['少1'], colors: ['青'], level: 3, ap: 1000, lp: 1, traits: ['少年探偵団'], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [] };
const KID2: CardDef = { id: 'KID2', no: 'KID2', kind: 'character', names: ['少2'], colors: ['青'], level: 3, ap: 1000, lp: 1, traits: ['少年探偵団'], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [] };

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
  resetDefRegistry(); _resetUidCounter(); _clearPendingEffectPickQueue();
  registerCardDef(HOST); registerCardDef(L5); registerCardDef(L2); registerCardDef(KID1); registerCardDef(KID2);
  (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = null;
});

describe('P1: mill n:{dyn} handler-local 解決 (PR265)', () => {
  it('$bound.<key>.level で bound カードの印字レベル枚数をリムーブ', () => {
    const s = base(); const ctx = ctxFor(s);
    (ctx.bindings as Record<string, unknown>)['$matched'] = [{ kind: 'card', area: 'deck', player: 'self', cardId: 'L5' }];
    s.players.self.deck = ['L2', 'L2', 'L2', 'L2', 'L2', 'L2', 'L2'];
    runAtom(s, 'mill' as never, { player: 'self', n: { dyn: '$bound.$matched.level' } }, ctx);
    expect(s.players.self.remove.length).toBe(5); // L5 の level=5 枚
    expect(s.players.self.deck.length).toBe(2);
  });
  it('number n は従来 byte 互換', () => {
    const s = base(); const ctx = ctxFor(s);
    s.players.self.deck = ['L2', 'L2', 'L2'];
    runAtom(s, 'mill' as never, { player: 'self', n: 2 }, ctx);
    expect(s.players.self.remove.length).toBe(2);
  });
});

describe('P2: drawUpToHandSize bind (B04048 a1)', () => {
  it('引いた cardId 群を bind (hand1 → n:3 で 2 枚 draw)', () => {
    const s = base(); const ctx = ctxFor(s);
    s.players.self.hand = ['L2'];
    s.players.self.deck = ['L5', 'KID1', 'KID2'];
    runAtom(s, 'drawUpToHandSize' as never, { player: 'self', n: 3, bind: '$drawn' }, ctx);
    const b = ((ctx.bindings as Record<string, Candidate[]>)['$drawn'] ?? []) as { cardId?: string }[];
    expect(b.map(x => x.cardId)).toEqual(['L5', 'KID1']);
    expect(s.players.self.hand.length).toBe(3);
  });
  it('手札が既に n 枚以上 → draw 0、bind は書かない (mill/discard 同 idiom)', () => {
    const s = base(); const ctx = ctxFor(s);
    s.players.self.hand = ['L2', 'L2', 'L2'];
    s.players.self.deck = ['L5'];
    runAtom(s, 'drawUpToHandSize' as never, { player: 'self', n: 3, bind: '$drawn' }, ctx);
    expect((ctx.bindings as Record<string, unknown>)['$drawn']).toBeUndefined();
    expect(s.players.self.hand.length).toBe(3);
  });
});

describe('P3: handToDeckBottom n:{dyn} (B04048 a1)', () => {
  it('$bound.<key>.count を短縮形 pick の n に解決 (pending nMin=nMax=2)', () => {
    const s = base(); const ctx = ctxFor(s);
    (ctx.bindings as Record<string, unknown>)['$drawn'] = [{ cardId: 'L5' }, { cardId: 'KID1' }];
    s.players.self.hand = ['L5', 'KID1', 'L2'];
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
    runAtom(s, 'handToDeckBottom' as never, { player: 'self', n: { dyn: '$bound.$drawn.count' } }, ctx);
    const p = _drainPendingEffectPickSide();
    expect(p).not.toBeNull();
    expect(p!.nMin).toBe(2);
    expect(p!.nMax).toBe(2);
  });
  it('dyn 解決値 0 → no-op (pick を出さない、QA「実質何も起こらない」)', () => {
    const s = base(); const ctx = ctxFor(s);
    // $drawn 未 bind = defensive 0
    s.players.self.hand = ['L5', 'KID1'];
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
    runAtom(s, 'handToDeckBottom' as never, { player: 'self', n: { dyn: '$bound.$drawn.count' } }, ctx);
    expect(_drainPendingEffectPickSide()).toBeNull();
    expect(s.players.self.hand.length).toBe(2);
  });
});

describe('P4: handToDeckBottom shuffleMoved (B04048 a1)', () => {
  it('移動群がデッキ下に置かれる (集合一致、hand 空)', () => {
    const s = base(); const ctx = ctxFor(s);
    s.players.self.hand = ['L5', 'KID1', 'KID2'];
    s.players.self.deck = ['L2'];
    runAtom(s, 'handToDeckBottom' as never, { player: 'self', target: ['L5', 'KID1', 'KID2'], shuffleMoved: true }, ctx);
    expect(s.players.self.hand.length).toBe(0);
    expect(s.players.self.deck.length).toBe(4);
    expect(s.players.self.deck[0]).toBe('L2'); // 既存デッキの上は不変
    expect([...s.players.self.deck.slice(1)].sort()).toEqual(['KID1', 'KID2', 'L5']);
  });
  it('shuffleMoved 未指定は picked 順 push (従来 byte 互換)', () => {
    const s = base(); const ctx = ctxFor(s);
    s.players.self.hand = ['L5', 'KID1'];
    s.players.self.deck = ['L2'];
    runAtom(s, 'handToDeckBottom' as never, { player: 'self', target: ['KID1', 'L5'] }, ctx);
    expect(s.players.self.deck).toEqual(['L2', 'KID1', 'L5']);
  });
});

describe('P5: sceneEnter cardIds-multi bind (B09019)', () => {
  it('登場した全キャラを bind (2枚登場 → $entered 2 entry)', () => {
    const s = base(); const ctx = ctxFor(s);
    s.players.self.remove = ['KID1', 'KID2'];
    runAtom(s, 'sceneEnter' as never, {
      player: 'self', cardIds: ['KID1', 'KID2'], viaEffect: true, bind: '$entered',
      target: { kind: 'pick', query: { area: 'remove', side: 'self' }, n: { min: 0, max: 5 }, chooser: 'self' },
    }, ctx);
    const b = ((ctx.bindings as Record<string, unknown>)['$entered'] ?? []) as { uid?: string; cardId?: string }[];
    expect(b.length).toBe(2);
    expect(b.map(x => x.cardId).sort()).toEqual(['KID1', 'KID2']);
    expect(s.players.self.remove.length).toBe(0);
  });
  it('scene-full skip 分は bind に含まれない (実登場のみ計数)', () => {
    const s = base(); const ctx = ctxFor(s); // HOST で scene 1
    for (let i = 0; i < 4; i++) mutate.scene.enter(s, 'self', 'L2', {}); // 5/5 満杯
    s.players.self.remove = ['KID1', 'KID2'];
    runAtom(s, 'sceneEnter' as never, {
      player: 'self', cardIds: ['KID1', 'KID2'], viaEffect: true, bind: '$entered',
      target: { kind: 'pick', query: { area: 'remove', side: 'self' }, n: { min: 0, max: 5 }, chooser: 'self' },
    }, ctx);
    const b = ((ctx.bindings as Record<string, unknown>)['$entered'] ?? []) as unknown[];
    expect(b.length).toBe(0); // switchUids 無し → 全 skip
  });
});

describe('P6: bindPick binds a resolved card multi-pick without moving cards (B04084)', () => {
  it('keeps selected remove cards in place and records their card candidates for a second pick', () => {
    const s = base(); const ctx = ctxFor(s);
    s.players.self.remove = ['KID1', 'KID2'];
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';

    run(s, {
      kind: 'sequence',
      steps: [
        {
          kind: 'atom', verb: 'bindPick', args: {
            player: 'self', cardIds: '$pick.cardIds', bind: '$selected',
            target: { kind: 'pick', query: { area: 'remove', side: 'self' }, n: { min: 0, max: 2 }, chooser: 'self' },
          },
        },
        { kind: 'atom', verb: 'noop', args: {} },
      ],
    } as never, ctx);
    const pending = _drainPendingEffectPickSide();

    expect(pending).not.toBeNull();
    const uids = pending!.candidates.map((c) => c.uid);
    applyPickAndContinuation(s, pending!, uids[0]!, uids);

    expect(s.players.self.remove).toEqual(['KID1', 'KID2']);
    expect((ctx.bindings as Record<string, Array<{ cardId: string }>>)['$selected']!.map((c) => c.cardId)).toEqual(['KID1', 'KID2']);
  });
});
