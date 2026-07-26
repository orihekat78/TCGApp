import { beforeEach, describe, expect, it } from 'vitest';
import { enumerateMoves } from '@/ai/move-enumerator';
import { stepTurn, type AIPolicy } from '@/ai/policy';
import { makeDeclaredAbilCtx } from '@/ai/ability-ctx';
import { B06103 } from '@/cards/ct-p06/B06103';
import { B06103P } from '@/cards/ct-p06/B06103P';
import { _setResolutionLock } from '@/engine/event/registry';
import { event } from '@/engine/event';
import { mutate } from '@/engine/mutate';
import { produce } from '@/engine/produce';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import type { AbilityDef, CardDef, GameState } from '@/engine/types';
import { canActivateDeclaredAbility } from '@/engine/flow/main/declared-ability';
import { enumDeclaredAbilityIdsFor, enumDeclaredAbilitySources } from '@/ui/hooks/useActionsPanelFlow/enumerators';
import { dispatchEngineAction } from '@/ui/hooks/useEngineDispatch';
import { useGameStateStore } from '@/ui/state/store';
import type { Move } from '@/ai/move-enumerator';

const payableId = 'BUG-246-PAYABLE';
const costlyId = 'BUG-246-COSTLY';

function declared(id: string, cost?: AbilityDef['cost']): AbilityDef {
  return {
    id,
    type: 'declared',
    scope: 'on-hand',
    cost,
    effect: { kind: 'atom', verb: 'noop', args: {} },
    description: '',
    ruleRefs: [],
  };
}

function card(id: string, ability: AbilityDef): CardDef {
  return {
    id, no: id, kind: 'character', names: [id], colors: ['青'], level: 1, ap: 0, lp: 1,
    traits: [], rarity: 'C', imageUrl: '', abilities: [ability], ruleRefs: [],
  };
}

function stateWith(selfHand: string[], oppHand: string[] = []): GameState {
  return produce(createEmptyGameState(), (draft) => {
    draft.turn = { number: 2, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    draft.players.self.hand = selfHand;
    draft.players.opp.hand = oppHand;
  });
}

function handUid(player: 'self' | 'opp', cardId: string): string {
  return `hand:${player}:${cardId}`;
}

function declaredMoves(state: GameState, player: 'self' | 'opp') {
  return enumerateMoves(state, player).filter((move) => move.kind === 'declaredAbility');
}

class DeclaredFirst implements AIPolicy {
  readonly name = 'declared-first';

  choose(_state: GameState, candidates: Move[]): Move | null {
    return candidates.find((move) => move.kind === 'declaredAbility') ?? null;
  }
}

beforeEach(() => {
  resetDefRegistry();
  _setResolutionLock(false, null);
  (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
  useGameStateStore.setState({ gameState: null, activeActionId: null, pendingEffectPick: null });
  registerCardDef(card(payableId, declared('a1')));
  registerCardDef(card(costlyId, declared('a1', {
    kind: 'removeFromHand',
    target: { kind: 'pick', query: { area: 'hand', side: 'self' }, n: { min: 2, max: 2 }, chooser: 'self' },
    n: 2,
  })));
});

describe('BUG-246: AI on-hand declared ability parity', () => {
  it('enumerates one payable on-hand declaration with the UI source and public dispatcher', () => {
    const state = stateWith([payableId, payableId]);
    const uid = handUid('self', payableId);

    expect(canActivateDeclaredAbility(state, uid, 'a1')).toBe(true);
    expect(enumDeclaredAbilitySources(state, 'self')).toEqual([uid]);
    expect(enumDeclaredAbilityIdsFor(state, uid)).toEqual(['a1']);
    expect(declaredMoves(state, 'self')).toEqual([{ kind: 'declaredAbility', uid, abilityId: 'a1' }]);

    useGameStateStore.setState({ gameState: state });
    expect(dispatchEngineAction({ type: 'declaredAbility', uid, abilId: 'a1' })).toEqual({ ok: true });
  });

  it('rejects unpaid, opponent, out-of-turn, resolver/pending, and stale hand sources across UI and AI', () => {
    const assertHidden = (state: GameState, player: 'self' | 'opp', uid: string) => {
      expect(canActivateDeclaredAbility(state, uid, 'a1')).toBe(false);
      expect(enumDeclaredAbilitySources(state, player)).not.toContain(uid);
      expect(enumDeclaredAbilityIdsFor(state, uid)).toEqual([]);
      expect(declaredMoves(state, player)).not.toContainEqual({ kind: 'declaredAbility', uid, abilityId: 'a1' });
      const before = JSON.stringify(state);
      useGameStateStore.setState({ gameState: state });
      expect(dispatchEngineAction({ type: 'declaredAbility', uid, abilId: 'a1' })).toEqual({ ok: false, reason: 'not-allowed' });
      expect(JSON.stringify(useGameStateStore.getState().gameState)).toBe(before);
    };

    const unpaid = stateWith([costlyId]);
    assertHidden(unpaid, 'self', handUid('self', costlyId));

    const opponent = stateWith([], [payableId]);
    assertHidden(opponent, 'opp', handUid('opp', payableId));

    const outOfTurn = produce(stateWith([payableId]), (draft) => { draft.turn.player = 'opp'; });
    assertHidden(outOfTurn, 'self', handUid('self', payableId));

    const nonMain = produce(stateWith([payableId]), (draft) => { draft.turn.phase = 'auto'; });
    assertHidden(nonMain, 'self', handUid('self', payableId));

    const pending = produce(stateWith([payableId]), (draft) => {
      event.queue(draft, { kind: 'atom', verb: 'noop', args: {} });
    });
    assertHidden(pending, 'self', handUid('self', payableId));

    _setResolutionLock(true, 'BUG-246-test');
    assertHidden(stateWith([payableId]), 'self', handUid('self', payableId));
    _setResolutionLock(false, null);

    const staleUid = handUid('self', payableId);
    assertHidden(stateWith([]), 'self', staleUid);
  });

  it.each([B06103, B06103P])('executes shipped $id from an opp duplicate hand through stepTurn', (shipped) => {
    registerCardDef(B06103);
    registerCardDef(B06103P);
    const state = produce(createEmptyGameState(), (draft) => {
      draft.turn = { number: 2, player: 'opp', phase: 'main', isFirstPlayerFirstTurn: false };
      draft.players.opp.case.status = '解決編';
      draft.players.opp.hand = [shipped.id, shipped.id];
      mutate.scene.enter(draft, 'opp', shipped.id, { active: true });
    });
    const uid = handUid('opp', shipped.id);

    expect(makeDeclaredAbilCtx(state, uid, 'a1')).toMatchObject({
      source: { cardId: shipped.id, uid, player: 'opp', area: 'hand' },
    });
    expect(declaredMoves(state, 'opp')).toContainEqual({ kind: 'declaredAbility', uid, abilityId: 'a1' });

    const step = stepTurn(state, new DeclaredFirst(), 'opp');

    expect(step.move).toEqual({ kind: 'declaredAbility', uid, abilityId: 'a1' });
    expect(step.nextState.players.opp.hand).toEqual([shipped.id]);
    expect(step.nextState.players.opp.remove).toEqual([shipped.id]);
    expect(step.nextState.players.opp.scene).toEqual([
      expect.objectContaining({ cardId: shipped.id, state: 'sleep' }),
    ]);
    expect(step.nextState.pendingEffects.every((entry) => entry.state === 'resolved')).toBe(true);
    expect(step.nextState.log.some((entry) => entry.action === 'declaredAbility' && entry.player === 'opp')).toBe(true);
  });
});
