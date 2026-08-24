import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { B09052 } from '@/cards/ct-p09/B09052';
import { event } from '@/engine/event';
import * as flow from '@/engine/flow';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { mutate } from '@/engine/mutate';
import { produce } from '@/engine/produce';
import { _resetRegistry, register } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import type { CardDef } from '@/engine/types';
import { _runDriverStep } from '@/ui/hooks/useContactFlowDriver';
import { dispatchEngineAction } from '@/ui/hooks/useEngineDispatch';
import { useContactModalStore } from '@/ui/hooks/useContactModalStore';
import { useGameStateStore } from '@/ui/state/store';

const COMBINED_NAME = '江戸川コナン&工藤新一';

function character(id: string, names: string[], ap: number): CardDef {
  return {
    id, no: id, kind: 'character', names, colors: ['青'], level: 3, ap, lp: 1,
    traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
  };
}

const COMBINED = character('W107-AI-COMBINED', [COMBINED_NAME, '江戸川コナン', '工藤新一'], 3000);
const TARGET = character('W107-AI-TARGET', ['AI対戦相手'], 5000);

beforeEach(() => {
  event._resetRegistry();
  _resetTriggeredRegistered();
  _resetRegistry();
  flow.action._resetActionContexts();
  useContactModalStore.getState()._reset();
  useGameStateStore.getState().resetMatchSessionState();
  for (const card of [B09052, COMBINED, TARGET]) register(card);
  registerTriggeredListener();
});

afterEach(() => {
  useGameStateStore.getState().resetMatchSessionState();
  useContactModalStore.getState()._reset();
  flow.action._resetActionContexts();
  event._resetRegistry();
  _resetTriggeredRegistered();
  _resetRegistry();
});

describe('contact driver constrained cut-in declarations', () => {
  it('AI supplies one registered name to B09052 instead of resolving an empty declaration', () => {
    const state = createEmptyGameState();
    state.turn = { number: 7, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    const sourceUid = mutate.scene.enter(state, 'self', COMBINED.id, {}).uid;
    const targetUid = mutate.scene.enter(state, 'opp', TARGET.id, {}).uid;
    state.players.opp.scene.find(card => card.uid === targetUid)!.state = 'sleep';
    state.players.self.hand = [B09052.id];
    useGameStateStore.setState({ gameState: state });
    expect(dispatchEngineAction({ type: 'actionDeclareChar', byUid: sourceUid, targetUid })).toEqual({ ok: true });
    const actionId = useGameStateStore.getState().activeActionId!;
    const decisionState = produce(useGameStateStore.getState().gameState!, draft => {
      const action = flow.action._getContext(draft, actionId)!;
      action.phase = 'action-1';
      action.firstUid = sourceUid;
      action.secondUid = targetUid;
      delete action.firstActed;
    });
    useGameStateStore.setState({ gameState: decisionState });

    _runDriverStep(decisionState, flow.action._getContext(decisionState, actionId)!, true);

    const after = useGameStateStore.getState().gameState!;
    const cutin = after.pendingEffects.find(entry => (
      entry.source.cardId === B09052.id && entry.source.abilityId === 'a2'
    ));
    expect(cutin?.dyn?.declaredName).toEqual(expect.any(String));
  });
});
