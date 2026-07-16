// BUG-167 — sceneSetState direct-uid must gate a 「そうした場合」 chain on actual state transition.
// rules/03: stun + sleep/stun stays stun; stun + active becomes sleep.
// rules/15: the chained tail only runs when the preceding effect was actually applied.

import { beforeEach, describe, expect, it } from 'vitest';
import { produce } from '@/engine/produce';
import { B04092 } from '@/cards/ct-p04/B04092';
import { B05041 } from '@/cards/ct-p05/B05041';
import { B07019 } from '@/cards/ct-p07/B07019';
import { run as runEffect } from '@/engine/effect/resolver';
import { runAtom } from '@/engine/effect/atom-handlers';
import {
  _clearPendingEffectPickQueue,
  _peekPendingEffectPickQueueLength,
  _peekPendingEffectPickSide,
} from '@/engine/effect/resolve-picks';
import { createEmptyGameState } from '@/engine/state-factory';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { makeChar, makeCtx } from '../../helpers/fixtures';
import type { CardDef, Effect, EffectCtx, GameState, Player } from '@/engine/types';

function withChar(player: Player, state: 'active' | 'sleep' | 'stun', cardId = 'HOST'): GameState {
  const s = createEmptyGameState();
  s.players[player].scene = [makeChar({ uid: `${player}-host`, cardId, state })];
  return s;
}

function ctx(player: Player, cardId = 'HOST', uid = `${player}-host`): EffectCtx {
  return makeCtx({
    source: { player, area: 'scene', cardId, abilityId: 'a1', uid },
    bindings: {},
    dyn: {},
  });
}

const followupChain = (uid: string, state: 'active' | 'sleep' | 'stun' = 'sleep'): Effect => ({
  kind: 'chain',
  steps: [
    { kind: 'atom', verb: 'sceneSetState', args: { uid, state } },
    { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
  ],
});

function abilityEffect(card: CardDef): Effect {
  const effect = card.abilities[0]?.effect;
  if (!effect) throw new Error(`${card.id} a1 effect missing`);
  return effect;
}

function runCardEffect(card: CardDef, player: Player, state: 'active' | 'sleep' | 'stun', optionalRun: boolean): {
  result: GameState;
  effectCtx: EffectCtx;
} {
  const uid = `${player}-host`;
  const s = withChar(player, state, card.id);
  // Both shipped tails use a pick. Give B04092 a real contact and B07019 a legal Lv7 target.
  s.players[player === 'self' ? 'opp' : 'self'].scene = [makeChar({
    uid: `${player}-target`,
    cardId: 'TARGET',
    state: 'sleep',
  })];
  const effectCtx = ctx(player, card.id, uid);
  effectCtx.dyn = { optionalRun };
  effectCtx.contact = {
    byUid: uid,
    targetUid: `${player}-target`,
    attackerSide: player,
  };
  const result = produce(s, draft => runEffect(draft, abilityEffect(card), effectCtx));
  return { result, effectCtx };
}

beforeEach(() => {
  _clearPendingEffectPickQueue();
  resetDefRegistry();
  registerCardDef(B05041);
  (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = 'self';
});

describe('BUG-167 atomSceneSetState actual-transition gate', () => {
  it('active→sleep applies and does not set chainStepNoApply', () => {
    const effectCtx = ctx('self');
    const result = produce(withChar('self', 'active'), draft => {
      runAtom(draft, 'sceneSetState', { uid: 'self-host', state: 'sleep' }, effectCtx);
    });
    expect(result.players.self.scene[0]?.state).toBe('sleep');
    expect(effectCtx.dyn?.chainStepNoApply).not.toBe(true);
  });

  it.each(['sleep', 'stun'] as const)('%s→sleep is a no-op and sets chainStepNoApply', initial => {
    const effectCtx = ctx('self');
    const result = produce(withChar('self', initial), draft => {
      runAtom(draft, 'sceneSetState', { uid: 'self-host', state: 'sleep' }, effectCtx);
    });
    expect(result.players.self.scene[0]?.state).toBe(initial);
    expect(effectCtx.dyn?.chainStepNoApply).toBe(true);
  });

  it('stun→active actually becomes sleep and does not set the gate', () => {
    const effectCtx = ctx('self');
    const result = produce(withChar('self', 'stun'), draft => {
      runAtom(draft, 'sceneSetState', { uid: 'self-host', state: 'active' }, effectCtx);
    });
    expect(result.players.self.scene[0]?.state).toBe('sleep');
    expect(effectCtx.dyn?.chainStepNoApply).not.toBe(true);
  });

  it('bound uid follows the same actual-transition gate', () => {
    const effectCtx = ctx('self');
    effectCtx.bindings.$picked = [{ kind: 'char', uid: 'self-host', player: 'self' }];
    produce(withChar('self', 'stun'), draft => {
      runAtom(draft, 'sceneSetState', { uid: '$picked.uid', state: 'sleep' }, effectCtx);
    });
    expect(effectCtx.dyn?.chainStepNoApply).toBe(true);
  });

  it('owner=opp direct uid uses the same gate', () => {
    const effectCtx = ctx('opp');
    produce(withChar('opp', 'stun'), draft => {
      runAtom(draft, 'sceneSetState', { uid: 'opp-host', state: 'sleep' }, effectCtx);
    });
    expect(effectCtx.dyn?.chainStepNoApply).toBe(true);
  });

  it('opponent protection blocks the transition and gates the chained tail', () => {
    const s = withChar('opp', 'active');
    s.players.opp.scene[0]!.setCards = [{ cardId: B05041.id, faceUp: true }];
    const effectCtx = ctx('self', 'SOURCE', 'source-uid');
    const result = produce(s, draft => {
      runAtom(draft, 'sceneSetState', { uid: 'opp-host', state: 'sleep' }, effectCtx);
    });
    expect(result.players.opp.scene[0]?.state).toBe('active');
    expect(effectCtx.dyn?.chainStepNoApply).toBe(true);
  });

  it('stun self-sleep stops the chained follow-up, active self-sleep permits it', () => {
    const stunned = withChar('self', 'stun');
    stunned.players.self.deck = ['DRAW'];
    const afterStun = produce(stunned, draft => runEffect(draft, followupChain('self-host'), ctx('self')));
    expect(afterStun.players.self.hand).toEqual([]);

    const active = withChar('self', 'active');
    active.players.self.deck = ['DRAW'];
    const afterActive = produce(active, draft => runEffect(draft, followupChain('self-host'), ctx('self')));
    expect(afterActive.players.self.hand).toEqual(['DRAW']);
  });
});

describe.each([B07019, B04092])('BUG-167 shipped family $id', card => {
  it('active opt-in sleeps self and reaches the shipped follow-up pick', () => {
    const { result } = runCardEffect(card, 'self', 'active', true);
    expect(result.players.self.scene[0]?.state).toBe('sleep');
    expect(_peekPendingEffectPickQueueLength()).toBe(1);
    expect(_peekPendingEffectPickSide()?.atomVerb).toBe(card.id === 'B07019' ? 'sceneRemove' : 'charModifyAP');
  });

  it.each(['sleep', 'stun'] as const)('%s opt-in does not reach the shipped follow-up', initial => {
    const { result } = runCardEffect(card, 'self', initial, true);
    expect(result.players.self.scene[0]?.state).toBe(initial);
    expect(_peekPendingEffectPickQueueLength()).toBe(0);
  });

  it('optional decline leaves the active card unchanged and never reaches the tail', () => {
    const { result } = runCardEffect(card, 'self', 'active', false);
    expect(result.players.self.scene[0]?.state).toBe('active');
    expect(_peekPendingEffectPickQueueLength()).toBe(0);
  });

  it('owner=opp active opt-in applies and reaches the tail for opp', () => {
    const { result } = runCardEffect(card, 'opp', 'active', true);
    expect(result.players.opp.scene[0]?.state).toBe('sleep');
    expect(_peekPendingEffectPickQueueLength()).toBe(1);
    expect(_peekPendingEffectPickSide()).toMatchObject({
      player: 'opp',
      atomVerb: card.id === 'B07019' ? 'sceneRemove' : 'charModifyAP',
    });
  });
});
