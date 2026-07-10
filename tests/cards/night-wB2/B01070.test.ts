// tests/cards/night-wB2/B01070 アンドレ・キャメル — engine additive probe (WB2)
//
// engine fix: triggerCharMatches に requireSource 追加 (payload[payloadKey] === ctx.source.uid を要求)。
//   a1「相手のキャラがこのキャラを指定してアクションしたとき」= action:declare payload.targetUid が source 自身。
//   同名複数現場でも uid 同定で 1対1 発火 (side+cardId filter だと over-fire)。a2/a3 は既存 primitive。
//
// production: 実 action 経路 declare() で opp が self の B01070 を指定 → charModifyAP+1000 実測 (decoy 非発火)。
//   requireSource は evalCond でも payload バリアント。event._resetRegistry (handler 累積回避)。

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from '@/engine/produce';
import { createEmptyGameState } from '@/engine/state-factory';
import { event } from '@/engine/event/index';
import { evalCond } from '@/engine/cond/eval';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { runAllUntilEmpty } from '@/engine/resolve/stack';
import { declare, _resetActionContexts } from '@/engine/flow/action/state-machine';
import { activateDeclaredAbility } from '@/engine/flow/main/ability-activate';
import { canDeclaredAbility } from '@/engine/flow/main/declared-ability';
import { _drainPendingEffectPickSide, _clearPendingEffectPickQueue } from '@/engine/effect/pending-state';
import { applyPickAndContinuation, applyPickSkipAndContinuation } from '@/engine/effect/apply-pick';
import { read } from '@/engine/read/index';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { makeChar } from '../../helpers/fixtures';
import { B01070 } from '@/cards/ct-p01/B01070';
import type { CardDef, Condition, EffectCtx, GameState, AbilityDef } from '@/engine/types';

function plain(id: string, over: Partial<CardDef> = {}): CardDef {
  return { id, no: `9/${id}`, kind: 'character', names: [id], colors: ['赤'], level: 5, ap: 5000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [], ...over };
}
const setHuman = (s: 'self' | 'opp' | null) => { (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = s; };

beforeEach(() => {
  event._resetRegistry();
  _resetTriggeredRegistered();
  resetDefRegistry();
  _resetActionContexts();
  _resetUidCounter();
  _clearPendingEffectPickQueue();
  registerCardDef(B01070);
  registerCardDef(plain('ATK'));
  registerCardDef(plain('DECOY'));
  registerTriggeredListener();
  setHuman(null);
});

function base(turnPlayer: 'self' | 'opp'): GameState {
  const s = createEmptyGameState();
  s.players.self.partner = { cardId: 'P-self', state: 'active', location: 'partner-area' } as GameState['players']['self']['partner'];
  s.players.opp.partner = { cardId: 'P-opp', state: 'active', location: 'partner-area' } as GameState['players']['opp']['partner'];
  s.players.self.case = { cardId: 'cs', status: '事件編', requiredEvidence: 7, colors: ['赤'], declaredUseCount: {} } as GameState['players']['self']['case'];
  s.players.opp.case = { cardId: 'co', status: '事件編', requiredEvidence: 6, colors: ['赤'], declaredUseCount: {} } as GameState['players']['opp']['case'];
  s.players.self.deck.push('d1', 'd2', 'd3');
  s.players.opp.deck.push('e1', 'e2', 'e3');
  s.turn = { number: 2, player: turnPlayer } as GameState['turn'];
  return s;
}

// ============================================================
// shape
// ============================================================
describe('B01070 — shape', () => {
  it('a1 action:declare requireSource / a2 declared sleepSelf ブレット / a3 hirameki', () => {
    const [a1, a2, a3] = B01070.abilities as AbilityDef[];
    expect(a1.trigger).toMatchObject({ hook: 'action:declare', matcherCondition: { kind: 'triggerCharMatches', payloadKey: 'targetUid', requireSource: true } });
    expect(a1.effect).toMatchObject({ kind: 'atom', verb: 'charModifyAP', args: { uid: '$self', delta: 1000, scope: 'contact' } });
    expect(a2.type).toBe('declared');
    expect(a2.cost).toMatchObject({ kind: 'sleepSelf' });
    expect(a2.effect).toMatchObject({ kind: 'atom', verb: 'charGrantKeyword', args: { kw: 'ブレット', scope: 'turn', side: 'either', max: 1 } });
    expect(a3.trigger).toMatchObject({ hook: 'evidence:remove-by-action', optional: true });
  });
});

// ============================================================
// a1 — requireSource gate (evalCond)
// ============================================================
describe('B01070 a1 — requireSource (evalCond)', () => {
  const cond: Condition = { kind: 'triggerCharMatches', payloadKey: 'targetUid', requireSource: true };
  function stateScene(): GameState {
    const s = createEmptyGameState();
    s.players.self.scene = [makeChar({ uid: 'u-cam', cardId: 'B01070', state: 'sleep' })];
    s.players.opp.scene = [makeChar({ uid: 'u-otherself', cardId: 'DECOY', state: 'sleep' })];
    return s;
  }
  function ctxCam(payload: unknown): EffectCtx {
    return { source: { cardId: 'B01070', uid: 'u-cam', abilityId: 'a1', player: 'self', area: 'scene' }, bindings: {}, triggerPayload: payload } as EffectCtx;
  }
  it('targetUid === source.uid → true', () => {
    expect(evalCond(stateScene(), cond, ctxCam({ targetUid: 'u-cam', uid: 'u-atk', player: 'opp' }))).toBe(true);
  });
  it('targetUid ≠ source.uid (別キャラ指定) → false', () => {
    expect(evalCond(stateScene(), cond, ctxCam({ targetUid: 'u-otherself', uid: 'u-atk', player: 'opp' }))).toBe(false);
  });
  it('targetUid 無し (アクション[事件]) → false', () => {
    expect(evalCond(stateScene(), cond, ctxCam({ uid: 'u-atk', player: 'opp' }))).toBe(false);
  });
});

// ============================================================
// a1 — production: opp が B01070 を指定してアクション → AP+1000
// ============================================================
describe('B01070 a1 — production (実 action 経路)', () => {
  function setup(): GameState {
    const s = base('opp'); // opp のターン (opp が攻撃)
    s.players.opp.scene.push(makeChar({ uid: 'u-atk', cardId: 'ATK', state: 'active' }));
    s.players.self.scene.push(makeChar({ uid: 'u-cam', cardId: 'B01070', state: 'sleep' })); // action 対象 = sleep
    s.players.self.scene.push(makeChar({ uid: 'u-decoy', cardId: 'DECOY', state: 'sleep' }));
    return s;
  }
  it('opp が B01070 を指定 → AP 6000→7000 (そのコンタクト中)', () => {
    const after = produce(setup(), (d) => {
      declare(d, 'u-atk', { kind: 'char', uid: 'u-cam' });
      runAllUntilEmpty(d);
    });
    expect(read.char.ap(after, 'u-cam'), '指定された B01070 は AP+1000').toBe(7000);
  });
  it('opp が別の自分キャラ(decoy)を指定 → B01070 は不発 (AP 6000 のまま)', () => {
    const after = produce(setup(), (d) => {
      declare(d, 'u-atk', { kind: 'char', uid: 'u-decoy' });
      runAllUntilEmpty(d);
    });
    expect(read.char.ap(after, 'u-cam'), 'B01070 未指定 → AP 変化なし').toBe(6000);
    expect(read.char.ap(after, 'u-decoy'), 'decoy は本能力対象外 → AP 変化なし').toBe(5000);
  });
});

// ============================================================
// a2 — 【宣言】【スリープ】ブレット付与 (declared, 1枚まで)
// ============================================================
describe('B01070 a2 — declared ブレット grant', () => {
  function setup(): GameState {
    const s = base('self');
    s.players.self.scene.push(makeChar({ uid: 'u-cam', cardId: 'B01070', state: 'active' }));
    s.players.self.scene.push(makeChar({ uid: 'u-ally', cardId: 'ATK', state: 'active' }));
    s.players.opp.scene.push(makeChar({ uid: 'u-enemy', cardId: 'DECOY', state: 'sleep' }));
    return s;
  }
  it('宣言可 (active) → 選んだキャラに ブレット付与 + 自身スリープ (cost)', () => {
    setHuman('self');
    const s0 = setup();
    expect(canDeclaredAbility(s0, 'u-cam', 'a2')).toBe(true);
    let st = produce(s0, (d) => {
      activateDeclaredAbility(d, 'u-cam', 'a2', undefined);
      runAllUntilEmpty(d);
    });
    const pick = _drainPendingEffectPickSide();
    expect(pick?.atomVerb, 'grant pick surface').toBe('charGrantKeyword');
    // どちらの現場のキャラも候補 (side either)
    const candIds = pick!.candidates.map((c) => c.cardId);
    expect(candIds).toEqual(expect.arrayContaining(['ATK', 'DECOY']));
    const ally = pick!.candidates.find((c) => c.cardId === 'ATK')!;
    st = produce(st, (d) => { applyPickAndContinuation(d, pick!, ally.uid); runAllUntilEmpty(d); });
    setHuman(null);
    expect(read.char.keywords(st, 'u-ally'), '選んだキャラに ブレット').toContain('ブレット');
    expect(read.char.state(st, 'u-cam'), 'cost sleepSelf で自身スリープ').toBe('sleep');
  });
  it('「1枚まで」= skip 可 (throw なし・付与なし)', () => {
    setHuman('self');
    let st = produce(setup(), (d) => { activateDeclaredAbility(d, 'u-cam', 'a2', undefined); runAllUntilEmpty(d); });
    const pick = _drainPendingEffectPickSide();
    st = produce(st, (d) => { applyPickSkipAndContinuation(d, pick!, false); runAllUntilEmpty(d); });
    setHuman(null);
    expect(read.char.keywords(st, 'u-ally')).not.toContain('ブレット');
  });
});
