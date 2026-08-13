import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { event } from '@/engine/event';
import { _clearPendingEffectPickQueue, _drainPendingEffectPickSide } from '@/engine/effect/pending-state';
import { applyPickAndContinuation, applyPickSkipAndContinuation } from '@/engine/effect/apply-pick';
import { declare, passGuard, snapshotAP, _resetActionContexts } from '@/engine/flow/action/state-machine';
import { judge } from '@/engine/flow/contact';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { mutate } from '@/engine/mutate';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { register, _resetRegistry } from '@/engine/read/def';
import { runAllUntilEmpty } from '@/engine/resolve';
import { createEmptyGameState } from '@/engine/state-factory';
import type { CardDef, GameState } from '@/engine/types';
import { B05066 } from '@/cards/ct-p05/B05066';
import { B05066P } from '@/cards/ct-p05/B05066P';

const LOW8 = 'B05066_LOW8';
const HIGH9 = 'B05066_HIGH9';
const VICTIM = 'B05066_VICTIM';
const REPLACEMENT = 'B05066_REPLACEMENT';
const RED_PARTNER = 'B05066_RED_PARTNER';
const BLUE_PARTNER = 'B05066_BLUE_PARTNER';

function character(id: string, level: number, ap = 1000): CardDef {
  return { id, no: id, kind: 'character', names: [id], colors: ['赤'], level, ap, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [] };
}

function partner(id: string, color: '赤' | '青'): CardDef {
  return { id, no: id, kind: 'partner', names: [id], colors: [color], traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [] };
}

function state(turnPlayer: 'self' | 'opp' = 'self'): GameState {
  const s = createEmptyGameState();
  s.turn = { number: 4, player: turnPlayer, phase: 'main', isFirstPlayerFirstTurn: false };
  s.players.self.partner.cardId = RED_PARTNER;
  return s;
}

function enterSource(s: GameState, cardId: string): string {
  return mutate.scene.enter(s, 'self', cardId, {}).uid;
}

beforeEach(() => {
  event._resetRegistry();
  _resetTriggeredRegistered();
  _resetActionContexts();
  _resetUidCounter();
  _resetRegistry();
  _clearPendingEffectPickQueue();
  (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
  [
    B05066, B05066P,
    character(LOW8, 8), character(HIGH9, 9), character(VICTIM, 1), character(REPLACEMENT, 1),
    partner(RED_PARTNER, '赤'), partner(BLUE_PARTNER, '青'),
  ].forEach(register);
  registerTriggeredListener();
});

afterEach(() => {
  (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = null;
});

describe.each([B05066, B05066P])('$id scene removal observer', (printed) => {
  it('maps the scene-only own-turn observer and keeps the parallel definition equivalent', () => {
    const a1 = printed.abilities.find(a => a.id === 'a1');
    expect(a1).toMatchObject({
      type: 'triggered', scope: 'on-scene',
      trigger: { hook: 'leave:to-remove', matcherCondition: { kind: 'removedCharMatches', side: 'opp' } },
      condition: { kind: 'and', cs: [{ kind: 'partnerColor', color: '赤' }, { kind: 'turn', player: 'self' }] },
      limit: { kind: 'turn', n: 1 },
      effect: { kind: 'atom', verb: 'sceneRemove', args: { player: 'self', side: 'either', max: 1, cause: 'effect', filter: { kind: 'character', levelMax: 8 } } },
    });
    expect(B05066P.abilities).toEqual(B05066.abilities);
  });

  it('observes an opponent contact removal, allows either-side level 8, excludes level 9, and consumes the limit after nested removal', () => {
    const s = state();
    const host = enterSource(s, printed.id);
    const selfLow = mutate.scene.enter(s, 'self', LOW8, {}).uid;
    const oppLow = mutate.scene.enter(s, 'opp', LOW8, {}).uid;
    const high = mutate.scene.enter(s, 'opp', HIGH9, {}).uid;
    const victim = mutate.scene.enter(s, 'opp', VICTIM, {}).uid;
    mutate.scene.setState(s, victim, 'sleep');

    const action = declare(s, host, { kind: 'char', uid: victim });
    passGuard(s, action); snapshotAP(s, action);
    expect(judge(s, action).defenderRemoved).toBe(true);
    runAllUntilEmpty(s);

    const pick = _drainPendingEffectPickSide();
    expect(pick?.nMin).toBe(0);
    expect(pick?.candidates.map(c => c.uid)).toEqual(expect.arrayContaining([selfLow, oppLow]));
    expect(pick?.candidates.map(c => c.uid)).not.toContain(high);
    applyPickAndContinuation(s, pick!, oppLow);
    runAllUntilEmpty(s);
    expect(s.players.opp.remove).toContain(LOW8);
    expect(_drainPendingEffectPickSide(), 'nested effect removal cannot recursively re-trigger the once-per-turn observer').toBeNull();

    const laterVictim = mutate.scene.enter(s, 'opp', VICTIM, {}).uid;
    mutate.scene.removeToRemove(s, laterVictim, 'effect');
    runAllUntilEmpty(s);
    expect(_drainPendingEffectPickSide(), 'first trigger remains consumed after selecting a target').toBeNull();
  });

  it('observes opponent switch and effect removal; selecting zero still consumes the turn limit', () => {
    const s = state();
    enterSource(s, printed.id);
    mutate.scene.enter(s, 'self', LOW8, {});
    const switched = mutate.scene.enter(s, 'opp', VICTIM, {}).uid;
    mutate.scene.switchEnter(s, 'opp', REPLACEMENT, switched, {});
    runAllUntilEmpty(s);
    const pick = _drainPendingEffectPickSide();
    expect(pick?.candidates.map(c => c.cardId)).toContain(LOW8);
    // The public dispatcher drops a declined standalone optional atom; it does
    // not re-run sceneRemove with __declined. This is the same no-target path.
    applyPickSkipAndContinuation(s, pick!, false);
    runAllUntilEmpty(s);

    const laterVictim = mutate.scene.enter(s, 'opp', VICTIM, {}).uid;
    mutate.scene.removeToRemove(s, laterVictim, 'effect');
    runAllUntilEmpty(s);
    expect(_drainPendingEffectPickSide(), 'zero selection consumed the once-per-turn trigger').toBeNull();

    const effectRemoval = state();
    enterSource(effectRemoval, printed.id);
    mutate.scene.enter(effectRemoval, 'self', LOW8, {});
    const effectVictim = mutate.scene.enter(effectRemoval, 'opp', VICTIM, {}).uid;
    mutate.scene.removeToRemove(effectRemoval, effectVictim, 'effect');
    runAllUntilEmpty(effectRemoval);
    expect(_drainPendingEffectPickSide()?.candidates.map(c => c.cardId), 'effect removal is also observed').toContain(LOW8);
  });

  it('does not observe own removals, opponent turns, or a copy in the partner area', () => {
    const ownRemoval = state();
    enterSource(ownRemoval, printed.id);
    const ownVictim = mutate.scene.enter(ownRemoval, 'self', VICTIM, {}).uid;
    mutate.scene.removeToRemove(ownRemoval, ownVictim, 'effect');
    runAllUntilEmpty(ownRemoval);
    expect(_drainPendingEffectPickSide()).toBeNull();

    const opponentTurn = state('opp');
    enterSource(opponentTurn, printed.id);
    const oppVictim = mutate.scene.enter(opponentTurn, 'opp', VICTIM, {}).uid;
    mutate.scene.removeToRemove(opponentTurn, oppVictim, 'effect');
    runAllUntilEmpty(opponentTurn);
    expect(_drainPendingEffectPickSide()).toBeNull();

    const partnerOnly = state();
    partnerOnly.players.self.partnerAreaMR = { ...mutate.scene.enter(state(), 'self', LOW8, {}), cardId: printed.id, uid: 'partner-only' };
    const partnerVictim = mutate.scene.enter(partnerOnly, 'opp', VICTIM, {}).uid;
    mutate.scene.removeToRemove(partnerOnly, partnerVictim, 'effect');
    runAllUntilEmpty(partnerOnly);
    expect(_drainPendingEffectPickSide(), 'partner-area copy is not an on-scene observer source').toBeNull();
  });

  it('does not trigger without a red partner', () => {
    const s = state();
    s.players.self.partner.cardId = BLUE_PARTNER;
    enterSource(s, printed.id);
    mutate.scene.enter(s, 'self', LOW8, {});
    const victim = mutate.scene.enter(s, 'opp', VICTIM, {}).uid;
    mutate.scene.removeToRemove(s, victim, 'effect');
    runAllUntilEmpty(s);
    expect(_drainPendingEffectPickSide()).toBeNull();
  });
});
