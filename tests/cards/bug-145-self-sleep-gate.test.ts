// BUG-145 self-state micro-cluster (2026-06-15):
// 「このキャラをスリープさせ(…)てもよい。そうした場合…」を持つ能力は、解決時に self が既に
// スリープなら optional 自体を行えない (公式qAndA PR138/PR144/B04049:
// 「スリープさせることができないので行えません」)。これは PR138 固有ではなく一般裁定。
//
// 修正 = 各能力に ability.condition `not{charStateIs(ref:self, state:'sleep')}` を AND する。
// triggered.ts:226-238 は ability.condition が false だと effect を walk する前に continue
// するため、self が sleep のとき能力は「非所持扱い」(rules/17) となり optional surface も出ない。
//
// 本テストは (1) charStateIs プリミティブ (2) 11 能力全部が self-sleep で condition=false になる
// (gate closed) こと (3) 非 merge カードは self-active で condition=true (gate open) を実証する。
// rules: 03-field-areas.md, 15-abilities-effects.md, 17-icons.md, 24-qa-naming-stun.md

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from 'immer';
import { evalCond } from '@/engine/cond/eval';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { createEmptyGameState } from '@/engine/state-factory';
import { register as registerCardDef, _resetRegistry as resetCardDefRegistry } from '@/engine/read/def';
import type { Condition, EffectCtx, GameState, CardDef } from '@/engine/types';
import { sceneChar, makeCtx } from '../helpers/fixtures';

import { PR138 } from '@/cards/pr-01/PR138';
import { PR144 } from '@/cards/pr-01/PR144';
import { B04049 } from '@/cards/ct-p04/B04049';
import { B09058 } from '@/cards/ct-p09/B09058';
import { B09058P } from '@/cards/ct-p09/B09058P';
import { B09057 } from '@/cards/ct-p09/B09057';
import { B06102 } from '@/cards/ct-p06/B06102';
import { B09065 } from '@/cards/ct-p09/B09065';
import { B09013 } from '@/cards/ct-p09/B09013';
import { B08058 } from '@/cards/ct-p08/B08058';
import { B08058P } from '@/cards/ct-p08/B08058P';

// [id, card, abilityIndex, hasOtherCondition?]. a1=index0, a2=index1.
// hasOtherCondition: AND-merge カード (active でも他条件次第なので active=true は assert しない)。
const GATED: Array<[string, CardDef, number, boolean]> = [
  ['PR138', PR138, 0, false], ['PR144', PR144, 0, false], ['B09058', B09058, 0, false],
  ['B09058P', B09058P, 0, false], ['B09057', B09057, 0, false], ['B09013', B09013, 1, false],
  ['B04049', B04049, 0, true], ['B06102', B06102, 0, true], ['B09065', B09065, 0, true],
  ['B08058', B08058, 1, true], ['B08058P', B08058P, 1, true],
];

// condition tree を再帰し charStateIs(ref:self, state:'sleep') を not 配下に含むか
function hasSleepGate(c: unknown): boolean {
  if (!c || typeof c !== 'object') return false;
  const cc = c as { kind?: string; c?: unknown; cs?: unknown[]; ref?: { kind?: string }; state?: string };
  if (cc.kind === 'not' && cc.c && typeof cc.c === 'object') {
    const inner = cc.c as { kind?: string; ref?: { kind?: string }; state?: string };
    if (inner.kind === 'charStateIs' && inner.ref?.kind === 'self' && inner.state === 'sleep') return true;
  }
  if (cc.kind === 'and' && Array.isArray(cc.cs)) return cc.cs.some(hasSleepGate);
  if (cc.kind === 'or' && Array.isArray(cc.cs)) return cc.cs.some(hasSleepGate);
  if (cc.c) return hasSleepGate(cc.c);
  return false;
}

function ctxForSelf(uid: string, cardId: string): EffectCtx {
  return makeCtx({ source: { player: 'self', cardId, abilityId: 'a', uid } as EffectCtx['source'] });
}

describe('BUG-145 — charStateIs プリミティブ (self の状態判定)', () => {
  it.each(['active', 'sleep', 'stun'] as const)('charStateIs(ref:self) が self=%s を正しく判定 + gate 式', (st) => {
    const s = createEmptyGameState();
    s.players.self.scene = [sceneChar('X', 'u0', { state: st })];
    const ctx = ctxForSelf('u0', 'X');
    for (const probe of ['active', 'sleep', 'stun'] as const) {
      const cond: Condition = { kind: 'charStateIs', ref: { kind: 'self' }, state: probe };
      expect(evalCond(s, cond, ctx), `charStateIs(${probe}) when self=${st}`).toBe(probe === st);
    }
    const gate: Condition = { kind: 'not', c: { kind: 'charStateIs', ref: { kind: 'self' }, state: 'sleep' } };
    expect(evalCond(s, gate, ctx), `gate open when self=${st}`).toBe(st !== 'sleep');
  });
});

describe('BUG-145 — 11 能力が self-sleep gate を持ち、self が sleep のとき非所持 (condition=false)', () => {
  it.each(GATED)('%s: ability.condition に charStateIs(self,sleep) gate を含む', (_id, card, idx) => {
    const cond = card.abilities[idx]!.condition;
    expect(cond, '能力に condition がある').toBeTruthy();
    expect(hasSleepGate(cond), 'condition 木に not{charStateIs self sleep} を含む').toBe(true);
  });

  it.each(GATED)('%s: self=sleep → ability.condition = false (gate closed, reanimate 不可)', (id, card, idx) => {
    // AND-merge カードの他条件 (partnerColor/turn/fileAtLeast) も満たす盤面を組んでも、
    // self が sleep なら必ず false になることを示す (gate 単独で false を強制する)。
    const s = createEmptyGameState();
    s.turn = { number: 6, player: 'self', phase: 'end', isFirstPlayerFirstTurn: false };
    s.players.self.scene = [sceneChar(id, 's0', { state: 'sleep' })];
    s.players.self.file = Array.from({ length: 8 }, () => ({ type: 'card-back' as const, cardId: 'FB' }));
    // partnerColor 赤 (B04049) — partner を赤に
    s.players.self.partner = { ...s.players.self.partner, cardId: 'REDPARTNER' };
    registerCardDef({ id: 'REDPARTNER', no: 'NO', kind: 'partner', names: ['P'], colors: ['赤'], level: 0, ap: 0, lp: 5, traits: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [] } as CardDef);
    const ctx = ctxForSelf('s0', id);
    expect(evalCond(s, card.abilities[idx]!.condition!, ctx)).toBe(false);
  });

  it.each(GATED.filter(g => !g[3]))('%s: self=active → ability.condition = true (gate open, 他条件なし)', (id, card, idx) => {
    const s = createEmptyGameState();
    s.players.self.scene = [sceneChar(id, 'a0', { state: 'active' })];
    const ctx = ctxForSelf('a0', id);
    expect(evalCond(s, card.abilities[idx]!.condition!, ctx)).toBe(true);
  });
});

// 実パイプライン: enter hook を sleep / active の PR138 に対して emit し、
// triggered listener が ability.condition で queue を gate する (sleep→pendingEffects 空) を実証。
describe('BUG-145 — 実パイプライン: enter hook の queue gate (PR138)', () => {
  beforeEach(() => {
    event._resetRegistry();
    _resetTriggeredRegistered();
    resetCardDefRegistry();
    registerCardDef(PR138);
    registerCardDef({ id: 'KZ6', no: 'NO', kind: 'character', names: ['KZ6'], colors: ['黒'], level: 6, ap: 4000, lp: 1, traits: ['黒ずくめの組織'], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [] } as CardDef);
    registerTriggeredListener();
  });

  function emitEnter(selfState: 'active' | 'sleep'): GameState {
    let s = createEmptyGameState();
    s.players.self.scene = [sceneChar('PR138', 'pr0', { state: selfState })];
    s.players.self.hand = ['HANDX'];
    s.players.self.remove = ['KZ6'];
    s = produce(s, (d) => {
      event.emit(d, 'enter', { uid: 'pr0', viaEffect: false, enterOrder: 0 }, { player: 'self', cardId: 'PR138', uid: 'pr0' });
    });
    return s;
  }

  it('self=active: enter で PR138 a1 が pendingEffects に積まれる (gate open)', () => {
    const s = emitEnter('active');
    const queued = s.pendingEffects.filter((p) => p.triggeredBy?.hook === 'enter' && p.source?.cardId === 'PR138');
    expect(queued.length, 'active なら a1 が queue される').toBeGreaterThanOrEqual(1);
  });

  it('self=sleep: enter で PR138 a1 は queue されない (gate closed, BUG-145)', () => {
    const s = emitEnter('sleep');
    const queued = s.pendingEffects.filter((p) => p.triggeredBy?.hook === 'enter' && p.source?.cardId === 'PR138');
    expect(queued.length, 'sleep なら condition=false で queue されない').toBe(0);
  });
});

// AND-merge カードは active かつ他条件成立で true (gate が他条件を壊さない) を 1 件確認 (B06102 turn:self)
describe('BUG-145 — AND-merge: gate は既存条件を壊さない', () => {
  it('B06102: self=active かつ自分ターン → condition = true', () => {
    const s = createEmptyGameState();
    s.turn = { number: 4, player: 'self', phase: 'end', isFirstPlayerFirstTurn: false };
    s.players.self.scene = [sceneChar('B06102', 'b0', { state: 'active' })];
    const ctx = ctxForSelf('b0', 'B06102');
    expect(evalCond(s, B06102.abilities[0]!.condition!, ctx)).toBe(true);
  });
  it('B06102: self=active だが相手ターン → condition = false (既存 turn:self 条件は維持)', () => {
    const s = createEmptyGameState();
    s.turn = { number: 4, player: 'opp', phase: 'end', isFirstPlayerFirstTurn: false };
    s.players.self.scene = [sceneChar('B06102', 'b0', { state: 'active' })];
    const ctx = ctxForSelf('b0', 'B06102');
    expect(evalCond(s, B06102.abilities[0]!.condition!, ctx)).toBe(false);
  });
});
