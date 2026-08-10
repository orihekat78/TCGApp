import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { registerAll } from '@/cards';
import { event } from '@/engine/event';
import { doReasoning } from '@/engine/flow/main/reasoning';
import {
  persistPendingRuntimeState,
  resetPendingRuntimeState,
} from '@/engine/effect/runtime-state';
import {
  _resetTriggeredRegistered,
  registerTriggeredListener,
} from '@/engine/listeners/triggered';
import {
  _resetRegistry as resetCardDefRegistry,
  register as registerCardDef,
} from '@/engine/read/def';
import { runAllUntilEmpty } from '@/engine/resolve';
import { createEmptyGameState } from '@/engine/state-factory';
import type { CardDef } from '@/engine/types';
import { surfacePendingSideChannels } from '@/ui/hooks/useEngineDispatch';
import { useGameStateStore } from '@/ui/state/store';
import { dispatchCurrentDecision } from '../../helpers/dispatch-current-decision';
import { sceneChar } from '../../helpers/fixtures';

const REASONER: CardDef = {
  id: 'REASONER2',
  no: 'NO',
  kind: 'character',
  names: ['reasoner'],
  colors: ['green'],
  level: 5,
  ap: 5000,
  lp: 2,
  traits: [],
  rarity: 'C',
  imageUrl: '',
  abilities: [],
  ruleRefs: [],
};

describe('optional public decision authority', () => {
  beforeEach(() => {
    event._resetRegistry();
    _resetTriggeredRegistered();
    resetCardDefRegistry();
    registerAll();
    registerTriggeredListener();
    registerCardDef(REASONER);
    resetPendingRuntimeState();
    useGameStateStore.getState().resetMatchSessionState();
    useGameStateStore.setState({ pendingDecisionSeq: 0 });
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
  });

  afterEach(() => {
    resetPendingRuntimeState();
    useGameStateStore.getState().resetMatchSessionState();
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = null;
  });

  it('uses resolver-owned trigger metadata when the mutable UI projection is forged', () => {
    const state = createEmptyGameState();
    state.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    state.players.self.scene = [
      sceneChar('B03038', 'tok#1'),
      sceneChar('REASONER2', 'r#1'),
    ];
    state.players.self.deck = ['e1', 'e2', 'draw1', 'rest'];

    doReasoning(state, 'r#1');
    runAllUntilEmpty(state);
    persistPendingRuntimeState(state);
    expect(useGameStateStore.getState().setGameState(state, { preserveRuntime: true })).toBe(true);
    surfacePendingSideChannels();

    const rendered = useGameStateStore.getState().pendingEffectOptional!;
    expect(rendered.triggerPayload).toMatchObject({ uid: 'r#1', player: 'self' });
    useGameStateStore.setState({
      pendingEffectOptional: {
        ...rendered,
        triggerPayload: {
          ...(rendered.triggerPayload as Record<string, unknown>),
          uid: 'tok#1',
        },
      },
    });

    expect(dispatchCurrentDecision({ type: 'optionalResolve', run: true })).toEqual({ ok: true });
    const resolved = useGameStateStore.getState().gameState!;
    expect(resolved.players.self.hand).toEqual(['e1']);
    expect(resolved.players.self.evidence).toEqual([]);
    expect(resolved.players.self.deck[0]).toBe('e2');
  });
});
