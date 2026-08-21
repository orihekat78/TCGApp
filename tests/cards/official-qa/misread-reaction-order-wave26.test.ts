// qa: card:B05015:32589b2605a57e1fe89295b9b2340e6874cd6600ca6756e790b5fbcad58bae18

import { beforeEach, describe, expect, it } from 'vitest';
import { registerAll } from '@/cards';
import { engine } from '@/engine';
import { event } from '@/engine/event';
import { _resetActionContexts } from '@/engine/flow/action/state-machine';
import { _resetTargetExpanders } from '@/engine/flow/action/target-expander';
import {
  _resetMisreadRegistered,
  _resetPendingMisread,
  registerMisreadListener,
} from '@/engine/listeners/misread';
import {
  _resetTriggeredRegistered,
  registerTriggeredListener,
} from '@/engine/listeners/triggered';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { createEmptyGameState } from '@/engine/state-factory';
import type { CardDef, SceneCharacter } from '@/engine/types';
import { dispatchEngineAction } from '@/ui/hooks/useEngineDispatch';
import { useGameStateStore } from '@/ui/state/store';
import { dispatchCurrentDecision } from '../../helpers/dispatch-current-decision';
import { sceneChar } from '../../helpers/fixtures';

const REASONER: CardDef = {
  id: 'W26_REASONER', no: 'W26/REASONER', kind: 'character', names: ['W26 reasoner'],
  colors: ['blue'], level: 1, ap: 0, lp: 5, traits: [], rarity: 'C', imageUrl: '',
  abilities: [], ruleRefs: [],
};

function makeCharacter(uid: string, cardId: string): SceneCharacter {
  return sceneChar(cardId, uid, { enterOrder: 0, enterOrderThisTurn: 0 });
}

function resetRuntime(): void {
  engine.cards._resetRegistry();
  event._resetRegistry();
  _resetActionContexts();
  _resetTargetExpanders();
  _resetUidCounter();
  _resetPendingMisread();
  _resetMisreadRegistered();
  _resetTriggeredRegistered();
  registerAll();
  engine.cards.register(REASONER);
  registerTriggeredListener();
  registerMisreadListener();
  useGameStateStore.setState({ gameState: null, activeActionId: null, pendingMisread: null });
  (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
}

function install(): void {
  const state = createEmptyGameState();
  state.turn = { number: 2, player: 'opp', phase: 'main', isFirstPlayerFirstTurn: false };
  state.players.opp.scene = [
    makeCharacter('reasoner', REASONER.id),
    makeCharacter('kojima', 'B05015'),
  ];
  state.players.self.scene = [
    makeCharacter('misread-1', 'B04079'),
    makeCharacter('misread-2', 'B06093'),
  ];
  state.players.opp.deck = Array.from({ length: 8 }, (_, index) => `evidence-${index}`);
  expect(useGameStateStore.getState().setGameState(state)).toBe(true);
}

describe('official QA Wave 26: multi-Misread reactions through the public dispatcher', () => {
  beforeEach(resetRuntime);

  it.each([
    ['scene order', false],
    ['reverse submitted order', true],
  ] as const)('%s emits one B05015 reaction per physical Misread card', (_label, reverse) => {
    install();
    expect(dispatchEngineAction({ type: 'reasoning', uid: 'reasoner' })).toEqual({ ok: true });
    const pending = useGameStateStore.getState().pendingMisread;
    expect(pending?.candidates).toEqual([
      { uid: 'misread-1', x: 1 },
      { uid: 'misread-2', x: 2 },
    ]);
    const picks = reverse ? [...pending!.candidates].reverse() : pending!.candidates;
    expect(dispatchCurrentDecision({ type: 'misreadResolve', picks })).toEqual({ ok: true });

    const after = useGameStateStore.getState().gameState!;
    expect(after.players.self.scene.map((card) => card.state)).toEqual(['sleep', 'sleep']);
    expect(after.players.opp.evidence).toHaveLength(2);
    expect(after.players.opp.scene.find((card) => card.uid === 'kojima')?.turnEffects.apMod_turn)
      .toBe(6000);
    expect(engine.read.char.ap(after, 'kojima')).toBe(12000);
    const reactions = after.pendingEffects.filter((entry) =>
      entry.source.cardId === 'B05015' && entry.triggeredBy.hook === 'misread:performed');
    expect(reactions).toHaveLength(2);
    expect(reactions.every((entry) => entry.state === 'resolved')).toBe(true);
    expect(useGameStateStore.getState().pendingMisread).toBeNull();
  });
});
