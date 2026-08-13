import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createEmptyGameState } from '@/engine/state-factory';
import { mutate } from '@/engine/mutate';
import { produce } from '@/engine/produce';
import {
  pushPendingEffectPickSide,
  resetPendingEffectSession,
} from '@/engine/effect/pending-state';
import {
  persistPendingRuntimeState,
  resetPendingRuntimeState,
} from '@/engine/effect/runtime-state';
import { cardOccurrenceWitness } from '@/engine/target/card-occurrence';
import { surfacePendingSideChannels } from '@/ui/hooks/useEngineDispatch';
import { useGameStateStore } from '@/ui/state/store';
import { dispatchCurrentDecision } from '../../helpers/dispatch-current-decision';

describe('effect-pick indexed occurrence authority', () => {
  beforeEach(() => {
    resetPendingEffectSession();
    resetPendingRuntimeState();
    useGameStateStore.getState().resetMatchSessionState();
    useGameStateStore.setState({ pendingDecisionSeq: 0 });
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
  });

  afterEach(() => {
    resetPendingEffectSession();
    resetPendingRuntimeState();
    useGameStateStore.getState().resetMatchSessionState();
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = null;
  });

  it('consumes a stale selected remove occurrence without running its atom or continuation', () => {
    const state = createEmptyGameState();
    state.players.self.remove = ['DUP'];
    state.players.self.deck = ['CONTINUATION'];
    const occurrenceWitness = cardOccurrenceWitness(state, 'self', 'remove');
    pushPendingEffectPickSide({
      player: 'self',
      candidates: [{
        uid: 'card:self:remove:DUP#0',
        kind: 'card',
        cardId: 'DUP',
        player: 'self',
        area: 'remove',
        index: 0,
        occurrenceWitness,
      }],
      atomVerb: 'handAddFromRemove',
      atomArgs: { player: 'self', cardIds: '$pick.cardIds' },
      nMin: 1,
      nMax: 1,
      source: { player: 'self', cardId: 'SOURCE', abilityId: 'a1', area: 'scene' },
      continuation: {
        kind: 'sequence',
        remainder: [{ kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } }],
        ctx: {
          source: { player: 'self', cardId: 'SOURCE', abilityId: 'a1', area: 'scene' },
          bindings: {},
        },
      },
    });
    persistPendingRuntimeState(state);
    expect(useGameStateStore.getState().setGameState(state, { preserveRuntime: true })).toBe(true);
    surfacePendingSideChannels();
    const pending = useGameStateStore.getState().pendingEffectPick!;

    useGameStateStore.setState({
      gameState: produce(state, (draft) => {
        mutate.remove.removeFromHere(draft, 'self', ['DUP']);
        mutate.remove.add(draft, 'self', ['DUP']);
      }),
    });

    expect(dispatchCurrentDecision({
      type: 'effectPickResolve',
      pickedUid: pending.candidates[0]!.uid,
    })).toEqual({ ok: true });
    const after = useGameStateStore.getState();
    expect(after.pendingEffectPick).toBeNull();
    expect(after.gameState?.players.self.remove).toEqual(['DUP']);
    expect(after.gameState?.players.self.hand).toEqual([]);
    expect(after.gameState?.players.self.deck).toEqual(['CONTINUATION']);
    expect(after.gameState?.log.at(-1)).toMatchObject({
      action: 'effect:pick',
      result: 'stale-selection',
    });
  });
});
