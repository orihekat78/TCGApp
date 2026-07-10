// tests/cards/night-wB2/B05009 (+ twin D10022) 毛利蘭 — engine additive probe (WB2)
//
// engine fix: enterSource condition に side 追加 + enter emit (scene.ts sceneEnter/sceneSwitch/group deploy) に
//   sourcePlayer 同梱。「自分のキャラの能力によって登場した場合」= viaEffect:true + sourceFilter:{kind:character}
//   + side:'self' (原因カード所有側 == 登場キャラ側)。a2 は既存 primitive (B01010 反撃一族 + bond gate)。
//
// production: cluster11 harness (summonFrom→sceneEnter atom→enter hook→runAllUntilEmpty) で a1 grant を実測。
//   a2/enterSource side は evalCond 直判定 + payload バリアント。event._resetRegistry (handler 累積回避)。

import { describe, it, expect, beforeEach } from 'vitest';
import { event } from '@/engine/event/index';
import { evalCond } from '@/engine/cond/eval';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { run as runEffect } from '@/engine/effect/resolver';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { createEmptyGameState } from '@/engine/state-factory';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { read } from '@/engine/read/index';
import { makeChar } from '../../helpers/fixtures';
import { B05009 } from '@/cards/ct-p05/B05009';
import { B05009P } from '@/cards/ct-p05/B05009P';
import { D10022 } from '@/cards/ct-d10/D10022';
import type { CardDef, Condition, Effect, EffectCtx, GameState, AbilityDef } from '@/engine/types';

function pchar(id: string, over: Partial<CardDef> = {}): CardDef {
  return { id, no: `9/${id}`, kind: 'character', names: [id], colors: ['青'], level: 4, ap: 4000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [], ...over };
}
function pevent(id: string, over: Partial<CardDef> = {}): CardDef {
  return { id, no: `9/${id}`, kind: 'event', names: [id], colors: ['青'], level: 3, traits: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [], ...over } as CardDef;
}

const SRC_CHAR = 'SRC_CHAR';
const SRC_EVENT = 'SRC_EVENT';
const KUDO = pchar('KUDO', { names: ['工藤新一'] });
const OTHER = pchar('OTHER', { names: ['別人'] });

beforeEach(() => {
  event._resetRegistry();
  _resetTriggeredRegistered();
  resetDefRegistry();
  _resetUidCounter();
  (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = null;
  registerCardDef(B05009);
  registerCardDef(B05009P);
  registerCardDef(D10022);
  registerCardDef(pchar(SRC_CHAR));
  registerCardDef(pevent(SRC_EVENT));
  registerCardDef(KUDO);
  registerCardDef(OTHER);
  registerTriggeredListener();
});

// sceneEnter を効果登場として駆動 (cluster11 harness)。srcPlayer = 原因カード所有側。
function summon(srcCardId: string, srcPlayer: 'self' | 'opp', enterPlayer: 'self' | 'opp', viaEffect = true): GameState {
  const s0 = createEmptyGameState();
  s0.players[enterPlayer].hand = ['B05009'];
  const ctx = { source: { cardId: srcCardId, uid: 'src#1', abilityId: 'a1', player: srcPlayer, area: 'scene' }, bindings: {} } as EffectCtx;
  const eff = { kind: 'atom', verb: 'sceneEnter', args: { player: enterPlayer, cardId: 'B05009', viaEffect, target: { query: { area: 'hand', side: enterPlayer } } } } as unknown as Effect;
  let st = s0;
  st = runEffectImmer(st, eff, ctx);
  return st;
}

import { produce } from 'immer';
function runEffectImmer(s: GameState, eff: Effect, ctx: EffectCtx): GameState {
  return produce(s, (d) => {
    runEffect(d, eff, ctx);
    runAllUntilEmpty(d);
  });
}

function enteredUid(s: GameState, player: 'self' | 'opp'): string {
  const sc = s.players[player].scene;
  return sc[sc.length - 1]!.uid;
}

// ============================================================
// shape
// ============================================================
describe('B05009 / D10022 — shape', () => {
  it('a1 enterSource side / a2 bond+removedCharMatches / a3 hirameki', () => {
    const [a1, a2, a3] = B05009.abilities as AbilityDef[];
    expect(a1.trigger).toMatchObject({ hook: 'enter', selfOnly: true });
    expect(a1.condition).toMatchObject({ kind: 'enterSource', viaEffect: true, sourceFilter: { kind: 'character' }, side: 'self' });
    expect(a1.effect).toMatchObject({ kind: 'atom', verb: 'charGrantKeyword', args: { uid: '$self', kw: '突撃', scope: 'turn' } });
    expect(a2.condition).toMatchObject({ kind: 'and' });
    expect(a2.trigger).toMatchObject({ hook: 'leave:to-remove' });
    expect(a3.trigger).toMatchObject({ hook: 'evidence:remove-by-action', optional: true });
  });
  it('twin D10022 は B05009 と同一能力構造 (別 cardId 0515/D10022)', () => {
    expect(D10022.names).toEqual(B05009.names);
    expect(D10022.ap).toBe(B05009.ap);
    expect(JSON.stringify(D10022.abilities)).toBe(JSON.stringify(B05009.abilities));
    expect(D10022.id).toBe('D10022');
  });
});

// ============================================================
// a1 — enterSource side (engine fix): evalCond payload バリアント
// ============================================================
describe('B05009 a1 — enterSource side gate (evalCond)', () => {
  const s = createEmptyGameState();
  const cond: Condition = { kind: 'enterSource', viaEffect: true, sourceFilter: { kind: 'character' }, side: 'self' };
  function ctxP(payload: unknown): EffectCtx {
    return { source: { cardId: 'B05009', uid: 'x#1', abilityId: 'a1', player: 'self', area: 'scene' }, bindings: {}, triggerPayload: payload } as EffectCtx;
  }
  beforeEach(() => { registerCardDef(pchar('CC')); registerCardDef(pevent('EE')); });

  it('自分側の原因カード(char) → true', () => {
    expect(evalCond(s, cond, ctxP({ viaEffect: true, sourceCardId: 'CC', sourcePlayer: 'self' }))).toBe(true);
  });
  it('相手側の原因カード → side:self 不成立で false', () => {
    expect(evalCond(s, cond, ctxP({ viaEffect: true, sourceCardId: 'CC', sourcePlayer: 'opp' }))).toBe(false);
  });
  it('sourcePlayer 不在 (旧 emit) → side:self 不成立で false', () => {
    expect(evalCond(s, cond, ctxP({ viaEffect: true, sourceCardId: 'CC' }))).toBe(false);
  });
  it('自分側でも原因がイベント → sourceFilter:{kind:character} 不成立で false', () => {
    expect(evalCond(s, cond, ctxP({ viaEffect: true, sourceCardId: 'EE', sourcePlayer: 'self' }))).toBe(false);
  });
  it('viaEffect:false (手動登場) → false', () => {
    expect(evalCond(s, cond, ctxP({ viaEffect: false, sourceCardId: 'CC', sourcePlayer: 'self' }))).toBe(false);
  });
});

// ============================================================
// a1 — production: enter emit sourcePlayer → 突撃 grant 実測
// ============================================================
describe('B05009 a1 — production (sceneEnter emit sourcePlayer)', () => {
  it('自分のキャラの能力で登場 → 突撃 付与', () => {
    const st = summon(SRC_CHAR, 'self', 'self', true);
    expect(read.char.keywords(st, enteredUid(st, 'self')), '自分char効果登場 → 突撃').toContain('突撃');
  });
  it('自分のイベントの効果で登場 → 突撃 なし (公式Q&A)', () => {
    const st = summon(SRC_EVENT, 'self', 'self', true);
    expect(read.char.keywords(st, enteredUid(st, 'self')), 'event 起因 → 未付与').not.toContain('突撃');
  });
  // note: 「相手のキャラの能力で自分の場に登場」の side:self=false は evalCond unit (sourcePlayer:'opp') で
  //   カバー済 (sceneEnter の hand-source 解決は source 相対で opp 起因の self 登場を素直に組めないため production 省略)。
  it('手動登場 (viaEffect:false) → 突撃 なし', () => {
    const st = summon(SRC_CHAR, 'self', 'self', false);
    expect(read.char.keywords(st, enteredUid(st, 'self')), 'viaEffect:false → 未付与').not.toContain('突撃');
  });
});

// ============================================================
// a2 — bond + removedCharMatches(by:self) gate (evalCond)
// ============================================================
describe('B05009 a2 — 絆工藤新一 + このキャラとのコンタクトで相手除去 (evalCond)', () => {
  const cond = (B05009.abilities[1] as AbilityDef).condition as Condition;
  function stateWithScene(kudo: boolean): GameState {
    const s = createEmptyGameState();
    s.players.self.scene = [
      makeChar({ uid: 'u-ran', cardId: 'B05009', state: 'active' }),
      ...(kudo ? [makeChar({ uid: 'u-kudo', cardId: 'KUDO', state: 'active' })] : []),
    ];
    return s;
  }
  function ctxRan(payload: unknown): EffectCtx {
    return { source: { cardId: 'B05009', uid: 'u-ran', abilityId: 'a2', player: 'self', area: 'scene' }, bindings: {}, triggerPayload: payload } as EffectCtx;
  }
  const removalPayload = { side: 'opp', cause: 'contact-ap', byUid: 'u-ran' };

  it('工藤新一 在場 + 相手キャラがこのキャラ(u-ran)とのコンタクトで除去 → true (draw)', () => {
    expect(evalCond(stateWithScene(true), cond, ctxRan(removalPayload))).toBe(true);
  });
  it('工藤新一 不在 → bond 不成立で false', () => {
    expect(evalCond(stateWithScene(false), cond, ctxRan(removalPayload))).toBe(false);
  });
  it('別のキャラとのコンタクトで除去 (byUid≠u-ran) → by:self 不成立で false', () => {
    expect(evalCond(stateWithScene(true), cond, ctxRan({ side: 'opp', cause: 'contact-ap', byUid: 'u-other' }))).toBe(false);
  });
  it('自分側キャラが除去された (side:self) → side:opp 不成立で false', () => {
    expect(evalCond(stateWithScene(true), cond, ctxRan({ side: 'self', cause: 'contact-ap', byUid: 'u-ran' }))).toBe(false);
  });
  it('コンタクト以外の除去 (cause≠contact-ap) → false', () => {
    expect(evalCond(stateWithScene(true), cond, ctxRan({ side: 'opp', cause: 'effect', byUid: 'u-ran' }))).toBe(false);
  });
});
