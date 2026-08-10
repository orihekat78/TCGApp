import { describe, expect, it } from 'vitest';
import { produce } from '@/engine/produce';
import { createEmptyGameState } from '@/engine/state-factory';
import { runAtom } from '@/engine/effect/atom-handlers';
import { run as runEffect } from '@/engine/effect/resolver';
import { runAllUntilEmpty } from '@/engine/resolve';
import { applyPickAndContinuation } from '@/engine/effect/apply-pick';
import { _clearPendingEffectPickQueue, _drainPendingEffectPickSide } from '@/engine/effect/resolve-picks';
import { evalCond } from '@/engine/cond/eval';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { makeChar, makeCtx } from '../../helpers/fixtures';
import type { Effect, EffectCtx } from '@/engine/types';
import { useGameStateStore } from '@/ui/state/store';
import { dispatchCurrentDecision } from '../../helpers/dispatch-current-decision';

describe('charRemoveSetCard exact occurrence (B06012)', () => {
  it('matches the set host trait through the source ref', () => {
    resetDefRegistry();
    registerCardDef({ id: 'HOST', no: 'HOST', kind: 'character', names: ['Host'], colors: ['blue'], level: 1, ap: 1000, lp: 1, traits: ['少年探偵団'], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [] });
    const s = createEmptyGameState();
    s.players.self.scene = [makeChar({ uid: 'host', cardId: 'HOST' })];
    expect(evalCond(s, { kind: 'charMatches', ref: { kind: 'self' }, filter: { trait: '少年探偵団' } }, makeCtx({ source: { player: 'self', area: 'scene', uid: 'host' } }))).toBe(true);
  });

  it('removes the named face-up set event, not the host stack tail', () => {
    const s = createEmptyGameState();
    s.players.self.scene = [makeChar({
      uid: 'host',
      setCards: [
        { cardId: 'DECOY_SET', faceUp: true, instanceId: 'decoy' },
        { cardId: 'B06012', faceUp: true, instanceId: 'target-1' },
        { cardId: 'B06012', faceUp: true, instanceId: 'target-2' },
        { cardId: 'TAIL_SET', faceUp: true, instanceId: 'tail' },
      ],
    })];

    const result = produce(s, draft => {
      runAtom(draft, 'charRemoveSetCard', { uid: 'host', setCardInstanceId: 'target-2' }, makeCtx());
    });

    expect(result.players.self.remove).toEqual(['B06012']);
    expect(result.players.self.scene[0]!.setCards.map((entry) => entry.instanceId)).toEqual(['decoy', 'target-1', 'tail']);
  });

  it('selects two duplicate-card occurrences without exposing hidden card identity', () => {
    resetDefRegistry();
    _clearPendingEffectPickQueue();
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
    registerCardDef({ id: 'HOST', no: 'HOST', kind: 'character', names: ['Host'], colors: ['blue'], level: 1, ap: 1000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [] });
    const state = createEmptyGameState();
    state.players.self.scene = [makeChar({
      uid: 'host',
      cardId: 'HOST',
      setCards: [
        { cardId: 'SECRET_DUPLICATE', faceUp: false, instanceId: 'occurrence-1' },
        { cardId: 'SECRET_DUPLICATE', faceUp: false, instanceId: 'occurrence-2' },
        { cardId: 'SECRET_DUPLICATE', faceUp: false, instanceId: 'occurrence-3' },
      ],
    })];
    const ctx: EffectCtx = {
      source: { cardId: 'SOURCE', uid: 'source', abilityId: 'a1', player: 'self', area: 'scene' },
      bindings: {},
    };
    const effect: Effect = {
      kind: 'atom',
      verb: 'charRemoveSetCard',
      args: { player: 'self', side: 'self', n: 2, minimumPolicy: 'exact', faceDownOnly: true, filter: { hasSetCards: true } },
    } as never;

    runEffect(state, effect, ctx);
    runAllUntilEmpty(state);
    const pending = _drainPendingEffectPickSide();
    expect(pending?.candidates).toHaveLength(3);
    expect(pending?.candidates.every(candidate => candidate.hidden === true)).toBe(true);
    expect(JSON.stringify(pending)).not.toContain('SECRET_DUPLICATE');

    const selected = pending!.candidates.slice(0, 2).map(candidate => candidate.uid);
    applyPickAndContinuation(state, pending!, selected[0]!, selected);

    expect(state.players.self.scene[0]!.setCards.map(card => card.instanceId)).toEqual(['occurrence-3']);
    expect(state.players.self.remove).toEqual(['SECRET_DUPLICATE', 'SECRET_DUPLICATE']);
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = null;
  });

  it('fizzles an exact stale occurrence atomically without running its continuation', () => {
    resetDefRegistry();
    _clearPendingEffectPickQueue();
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
    registerCardDef({ id: 'HOST', no: 'HOST', kind: 'character', names: ['Host'], colors: ['blue'], level: 1, ap: 1000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [] });
    const state = createEmptyGameState();
    state.players.self.scene = [makeChar({
      uid: 'host',
      cardId: 'HOST',
      setCards: [
        { cardId: 'SECRET_A', faceUp: false, instanceId: 'occurrence-a' },
        { cardId: 'SECRET_B', faceUp: false, instanceId: 'occurrence-b' },
        { cardId: 'SECRET_C', faceUp: false, instanceId: 'occurrence-c' },
      ],
    })];
    state.players.self.deck = ['DRAW_TAIL'];
    const ctx: EffectCtx = {
      source: { cardId: 'SOURCE', uid: 'source', abilityId: 'a1', player: 'self', area: 'scene' },
      bindings: {},
    };
    runEffect(state, {
      kind: 'sequence',
      steps: [
        {
          kind: 'atom',
          verb: 'charRemoveSetCard',
          args: { player: 'self', side: 'self', n: 2, minimumPolicy: 'exact', faceDownOnly: true, filter: { hasSetCards: true } },
        } as never,
        { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } } as never,
      ],
    }, ctx);
    runAllUntilEmpty(state);
    const pending = _drainPendingEffectPickSide()!;
    const selected = pending.candidates.slice(0, 2).map(candidate => candidate.uid);

    state.players.self.scene[0]!.setCards.splice(0, 1);
    const before = structuredClone(state);
    applyPickAndContinuation(state, pending, selected[0]!, selected);

    expect(state.players.self.scene[0]!.setCards).toEqual(before.players.self.scene[0]!.setCards);
    expect(state.players.self.remove).toEqual(before.players.self.remove);
    expect(state.players.self.hand).toEqual([]);
    expect(state.players.self.deck).toEqual(['DRAW_TAIL']);
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = null;
  });

  it('resolves an exact same-host pair through the public decision boundary', () => {
    resetDefRegistry();
    _clearPendingEffectPickQueue();
    useGameStateStore.getState().resetMatchSessionState();
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
    registerCardDef({ id: 'HOST', no: 'HOST', kind: 'character', names: ['Host'], colors: ['blue'], level: 1, ap: 1000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [] });
    const state = createEmptyGameState();
    state.players.self.scene = [makeChar({
      uid: 'host',
      cardId: 'HOST',
      setCards: [
        { cardId: 'SECRET_A', faceUp: false, instanceId: 'occurrence-a' },
        { cardId: 'SECRET_B', faceUp: false, instanceId: 'occurrence-b' },
      ],
    })];
    state.players.self.deck = ['DRAW_TAIL', 'DECK_RESERVE'];
    const ctx: EffectCtx = {
      source: { cardId: 'SOURCE', uid: 'source', abilityId: 'a1', player: 'self', area: 'scene' },
      bindings: {},
    };
    runEffect(state, {
      kind: 'sequence',
      steps: [
        {
          kind: 'atom',
          verb: 'charRemoveSetCard',
          args: { player: 'self', side: 'self', n: 2, minimumPolicy: 'exact', faceDownOnly: true, filter: { hasSetCards: true } },
        } as never,
        { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } } as never,
      ],
    }, ctx);
    runAllUntilEmpty(state);
    const pending = _drainPendingEffectPickSide()!;
    useGameStateStore.getState().setGameState(state);
    useGameStateStore.getState().setPendingEffectPick(pending);
    const surfaced = useGameStateStore.getState().pendingEffectPick!;
    const pickedUids = surfaced.candidates.map(candidate => candidate.uid);

    expect(dispatchCurrentDecision({
      type: 'effectPickResolve',
      pickedUid: pickedUids[0]!,
      pickedUids,
    })).toEqual({ ok: true });
    expect(useGameStateStore.getState().gameState?.players.self.scene[0]!.setCards).toEqual([]);
    expect(useGameStateStore.getState().gameState?.players.self.remove).toEqual(['SECRET_A', 'SECRET_B']);
    expect(useGameStateStore.getState().gameState?.players.self.hand).toEqual(['DRAW_TAIL']);
    expect(useGameStateStore.getState().pendingEffectPick).toBeNull();
    useGameStateStore.getState().resetMatchSessionState();
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = null;
  });
});
