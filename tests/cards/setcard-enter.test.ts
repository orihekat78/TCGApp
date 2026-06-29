// engine additive (2026-06-29) — setcard:enter hook + setCardMatches condition.
// 「このキャラにカード(1枚)がセットされるたび/とき」(B02018 / B06046) を実 engine 経路で駆動。
//
// 検証 (公式テキスト + qAndA と 1対1):
//   §A host-self: HOST に set → HOST 自身 (selfOnly) の a1 が発火 (1ドロー)。
//   §B host-self gate DECOY: HOST_A と HOST_B が同 ability を持つ。HOST_A に set → A のみ発火 (1ドロー、2ではない)。
//      selfOnly が壊れて「任意の set で発火」なら 2ドローになり fail。
//   §C setCardMatches (B06046 〚特徴[YAIBA]〛):
//      c1 faceUp:true の YAIBA カードを set → 発火。
//      c2 faceUp:true の 非YAIBA を set → 不発。
//      c3 faceUp:FALSE の YAIBA を set → 不発 (裏向きは情報を持たない rules/16 = 載荷 decoy)。
//   §D per-occurrence + limit{turn,n:2}: 3回 set → 2ドロー上限 (公式Q&A 回数制限消費)。
// rules: 16-card-set.md / 15 / 17

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from '@/engine/produce';
import { createEmptyGameState } from '@/engine/state-factory';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { registerAll } from '@/cards/index';
import { mutate } from '@/engine/mutate/index';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { _resetUidCounter } from '@/engine/mutate/scene';
import type { CardDef, GameState } from '@/engine/types';

// neutral host with a setcard:enter selfOnly draw ability (option: matcherCondition / limit)
function phost(id: string, opts: { matcher?: object; limitN?: number } = {}): CardDef {
  const trigger: Record<string, unknown> = { hook: 'setcard:enter', selfOnly: true };
  if (opts.matcher) trigger['matcherCondition'] = opts.matcher;
  const ability: Record<string, unknown> = {
    id: 'a1', type: 'triggered', trigger,
    effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
    description: '', ruleRefs: [],
  };
  if (opts.limitN) ability['limit'] = { kind: 'turn', n: opts.limitN };
  return {
    id, no: `9/${id}`, kind: 'character', names: [id], colors: ['白'], level: 3, ap: 1000, lp: 1,
    traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [ability], ruleRefs: [],
  } as unknown as CardDef;
}
function pcard(id: string, traits: string[]): CardDef {
  return {
    id, no: `9/${id}`, kind: 'character', names: [id], colors: ['白'], level: 1, ap: 0, lp: 0,
    traits, keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
  } as unknown as CardDef;
}

const HOST = 'HOST', HOST2 = 'HOST2', HOSTY = 'HOSTY', HOSTL = 'HOSTL';

beforeEach(() => {
  event._resetRegistry();
  _resetTriggeredRegistered();
  resetDefRegistry();
  _resetUidCounter();
  registerAll();
  registerCardDef(phost(HOST));
  registerCardDef(phost(HOST2));
  registerCardDef(phost(HOSTY, { matcher: { kind: 'setCardMatches', filter: { trait: 'YAIBA' } } }));
  registerCardDef(phost(HOSTL, { limitN: 2 }));
  registerCardDef(pcard('YCARD', ['YAIBA']));
  registerCardDef(pcard('NCARD', ['探偵']));
  registerTriggeredListener();
});

function base(): GameState {
  return produce(createEmptyGameState(), (d) => {
    d.turn.player = 'self';
    d.players.self.deck = ['D1', 'D2', 'D3', 'D4', 'D5'];
  });
}

describe('setcard:enter — host-self trigger', () => {
  it('§A set a card onto HOST → HOST a1 fires (1 draw)', () => {
    let s = base();
    let hostUid = '';
    s = produce(s, (d) => { hostUid = mutate.scene.enter(d, 'self', HOST, {}).uid; });
    const before = s.players.self.hand.length;
    const after = produce(s, (d) => { mutate.char.setCard(d, hostUid, 'X', false); runAllUntilEmpty(d); });
    expect(after.players.self.hand.length).toBe(before + 1);
  });

  it('§B host-self gate DECOY: two hosts, set onto A → only A fires (1 draw, not 2)', () => {
    let s = base();
    let aUid = '';
    s = produce(s, (d) => {
      aUid = mutate.scene.enter(d, 'self', HOST, {}).uid;
      mutate.scene.enter(d, 'self', HOST2, {}); // B also subscribes, must NOT fire
    });
    const before = s.players.self.hand.length;
    const after = produce(s, (d) => { mutate.char.setCard(d, aUid, 'X', false); runAllUntilEmpty(d); });
    // selfOnly が壊れて「任意 host が発火」なら +2 になる
    expect(after.players.self.hand.length).toBe(before + 1);
  });
});

describe('setcard:enter — setCardMatches trait/faceUp gate (B06046)', () => {
  function fire(setCardId: string, faceUp: boolean): number {
    let s = base();
    let hostUid = '';
    s = produce(s, (d) => { hostUid = mutate.scene.enter(d, 'self', HOSTY, {}).uid; });
    const before = s.players.self.hand.length;
    const after = produce(s, (d) => { mutate.char.setCard(d, hostUid, setCardId, faceUp); runAllUntilEmpty(d); });
    return after.players.self.hand.length - before;
  }
  it('c1 faceUp YAIBA set card → fires', () => { expect(fire('YCARD', true)).toBe(1); });
  it('c2 faceUp non-YAIBA set card → does NOT fire', () => { expect(fire('NCARD', true)).toBe(0); });
  it('c3 face-DOWN YAIBA set card → does NOT fire (rules/16: 裏向きは情報を持たない)', () => { expect(fire('YCARD', false)).toBe(0); });
});

describe('setcard:enter — per-occurrence + limit{turn,n:2}', () => {
  it('§D three sets onto host → caps at 2 draws', () => {
    let s = base();
    let hostUid = '';
    s = produce(s, (d) => { hostUid = mutate.scene.enter(d, 'self', HOSTL, {}).uid; });
    const before = s.players.self.hand.length;
    const after = produce(s, (d) => {
      mutate.char.setCard(d, hostUid, 'X1', false); runAllUntilEmpty(d);
      mutate.char.setCard(d, hostUid, 'X2', false); runAllUntilEmpty(d);
      mutate.char.setCard(d, hostUid, 'X3', false); runAllUntilEmpty(d);
    });
    expect(after.players.self.hand.length).toBe(before + 2); // 【ターン2】上限
  });
});
