// qa: card:B04079:c61cc842e775e8f40c3ccc90d41e595b2e2e02184cc4d243534b3c2fdf721fdb
// qa: card:B05012:c61cc842e775e8f40c3ccc90d41e595b2e2e02184cc4d243534b3c2fdf721fdb
// qa: card:B05073:c61cc842e775e8f40c3ccc90d41e595b2e2e02184cc4d243534b3c2fdf721fdb
// qa: card:B05080:c61cc842e775e8f40c3ccc90d41e595b2e2e02184cc4d243534b3c2fdf721fdb
// qa: card:B06007:c61cc842e775e8f40c3ccc90d41e595b2e2e02184cc4d243534b3c2fdf721fdb
// qa: card:B06030:c61cc842e775e8f40c3ccc90d41e595b2e2e02184cc4d243534b3c2fdf721fdb
// qa: card:B06056:c61cc842e775e8f40c3ccc90d41e595b2e2e02184cc4d243534b3c2fdf721fdb
// qa: card:B06093:c61cc842e775e8f40c3ccc90d41e595b2e2e02184cc4d243534b3c2fdf721fdb
// qa: card:B07045:c61cc842e775e8f40c3ccc90d41e595b2e2e02184cc4d243534b3c2fdf721fdb
// qa: card:B07073:c61cc842e775e8f40c3ccc90d41e595b2e2e02184cc4d243534b3c2fdf721fdb
// qa: card:B08011:c61cc842e775e8f40c3ccc90d41e595b2e2e02184cc4d243534b3c2fdf721fdb
// qa: card:B09016:c61cc842e775e8f40c3ccc90d41e595b2e2e02184cc4d243534b3c2fdf721fdb
// qa: card:B09063:c61cc842e775e8f40c3ccc90d41e595b2e2e02184cc4d243534b3c2fdf721fdb
// qa: card:B10016:c61cc842e775e8f40c3ccc90d41e595b2e2e02184cc4d243534b3c2fdf721fdb
// qa: card:B10040:c61cc842e775e8f40c3ccc90d41e595b2e2e02184cc4d243534b3c2fdf721fdb
// qa: card:B10045:c61cc842e775e8f40c3ccc90d41e595b2e2e02184cc4d243534b3c2fdf721fdb
// qa: card:B10071:c61cc842e775e8f40c3ccc90d41e595b2e2e02184cc4d243534b3c2fdf721fdb
// qa: card:B01045:c43d44228555c6f52877b10cd4fc1e477898170ca1d8b5e1675225ab8ca0b4f4
// qa: card:B01093:c43d44228555c6f52877b10cd4fc1e477898170ca1d8b5e1675225ab8ca0b4f4
// qa: card:B02060:c43d44228555c6f52877b10cd4fc1e477898170ca1d8b5e1675225ab8ca0b4f4
// qa: card:B02082:c43d44228555c6f52877b10cd4fc1e477898170ca1d8b5e1675225ab8ca0b4f4
// qa: card:B03009:c43d44228555c6f52877b10cd4fc1e477898170ca1d8b5e1675225ab8ca0b4f4
// qa: card:B03037:c43d44228555c6f52877b10cd4fc1e477898170ca1d8b5e1675225ab8ca0b4f4
// qa: card:B03053:c43d44228555c6f52877b10cd4fc1e477898170ca1d8b5e1675225ab8ca0b4f4
// qa: card:B03125:c43d44228555c6f52877b10cd4fc1e477898170ca1d8b5e1675225ab8ca0b4f4
// qa: card:D01010:c43d44228555c6f52877b10cd4fc1e477898170ca1d8b5e1675225ab8ca0b4f4
// qa: card:D02009:c43d44228555c6f52877b10cd4fc1e477898170ca1d8b5e1675225ab8ca0b4f4
// qa: card:D03010:c43d44228555c6f52877b10cd4fc1e477898170ca1d8b5e1675225ab8ca0b4f4
// qa: card:D04007:c43d44228555c6f52877b10cd4fc1e477898170ca1d8b5e1675225ab8ca0b4f4
// qa: card:D04008:c43d44228555c6f52877b10cd4fc1e477898170ca1d8b5e1675225ab8ca0b4f4
// qa: card:D05011:c43d44228555c6f52877b10cd4fc1e477898170ca1d8b5e1675225ab8ca0b4f4
// qa: card:D07016:c43d44228555c6f52877b10cd4fc1e477898170ca1d8b5e1675225ab8ca0b4f4
// qa: card:D07017:c43d44228555c6f52877b10cd4fc1e477898170ca1d8b5e1675225ab8ca0b4f4

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
import { _resetUidCounter } from '@/engine/mutate/scene';
import { createEmptyGameState } from '@/engine/state-factory';
import type { CardDef, GameState, SceneCharacter } from '@/engine/types';
import { dispatchEngineAction } from '@/ui/hooks/useEngineDispatch';
import { useGameStateStore } from '@/ui/state/store';
import { dispatchCurrentDecision } from '../../helpers/dispatch-current-decision';
import { sceneChar } from '../../helpers/fixtures';

const REASONER: CardDef = {
  id: 'W18_REASONER', no: 'W18/REASONER', kind: 'character', names: ['W18 reasoner'],
  colors: ['blue'], level: 1, ap: 0, lp: 5, traits: [], rarity: 'C', imageUrl: '',
  abilities: [], ruleRefs: [],
};

const SINGLE_CASES = [
  ['B04079', 1], ['B05012', 1], ['B05073', 1], ['B05080', 1],
  ['B06007', 1], ['B06030', 1], ['B06056', 1], ['B06093', 2],
  ['B07045', 1], ['B07073', 1], ['B08011', 1], ['B09016', 1],
  ['B09063', 1], ['B10016', 1], ['B10040', 1], ['B10045', 1], ['B10071', 3],
] as const;

const MULTI_CASES = [
  'B01045', 'B01093', 'B02060', 'B02082', 'B03009', 'B03037', 'B03053', 'B03125',
  'D01010', 'D02009', 'D03010', 'D04007', 'D04008', 'D05011', 'D07016', 'D07017',
] as const;

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
  registerAll();
  engine.cards.register(REASONER);
  registerMisreadListener();
  useGameStateStore.setState({ gameState: null, activeActionId: null, pendingMisread: null });
  (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
}

function install(defenderCardIds: readonly string[]): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 2, player: 'opp', phase: 'main', isFirstPlayerFirstTurn: false };
  state.players.opp.scene = [makeCharacter('reasoner', REASONER.id)];
  state.players.self.scene = defenderCardIds.map((cardId, index) => makeCharacter(`misread-${index}`, cardId));
  state.players.opp.deck = Array.from({ length: 8 }, (_, index) => `evidence-${index}`);
  expect(useGameStateStore.getState().setGameState(state)).toBe(true);
  return state;
}

function beginReasoning(): NonNullable<ReturnType<typeof useGameStateStore.getState>['pendingMisread']> {
  expect(dispatchEngineAction({ type: 'reasoning', uid: 'reasoner' })).toEqual({ ok: true });
  const pending = useGameStateStore.getState().pendingMisread;
  expect(pending).not.toBeNull();
  expect(useGameStateStore.getState().gameState?.players.opp.evidence).toHaveLength(0);
  return pending!;
}

describe('official QA Wave 18: Misread through the public dispatcher', () => {
  beforeEach(resetRuntime);

  // Card-bound matrix: B04079 B05012 B05073 B05080 B06007 B06030 B06056 B06093 B07045 B07073 B08011 B09016 B09063 B10016 B10040 B10045 B10071.
  it.each(SINGLE_CASES)('%s exposes its printed X and combines within one reasoning', (cardId, x) => {
    install([cardId, 'B06093']);
    const pending = beginReasoning();
    expect(pending.candidates).toEqual([{ uid: 'misread-0', x }, { uid: 'misread-1', x: 2 }]);
    expect(dispatchCurrentDecision({ type: 'misreadResolve', picks: pending.candidates })).toEqual({ ok: true });

    const after = useGameStateStore.getState();
    expect(after.gameState?.players.self.scene.map((card) => card.state)).toEqual(['sleep', 'sleep']);
    expect(after.gameState?.players.opp.evidence).toHaveLength(3 - x);
    expect(after.gameState?.players.opp.scene[0].lpOverride).toBeNull();
    expect(after.gameState?.players.opp.scene[0].turnEffects.lpMod_reasoning).toBeUndefined();
    expect(after.pendingMisread).toBeNull();
  });

  // Card-bound matrix: B01045 B01093 B02060 B02082 B03009 B03037 B03053 B03125 D01010 D02009 D03010 D04007 D04008 D05011 D07016 D07017.
  it.each(MULTI_CASES)('%s can combine with another Misread in one public decision', (cardId) => {
    install([cardId, 'B06093']);
    const pending = beginReasoning();
    expect(pending.candidates).toEqual([
      { uid: 'misread-0', x: 1 },
      { uid: 'misread-1', x: 2 },
    ]);
    expect(dispatchCurrentDecision({ type: 'misreadResolve', picks: pending.candidates })).toEqual({ ok: true });

    const after = useGameStateStore.getState();
    expect(after.gameState?.players.self.scene.map((card) => card.state)).toEqual(['sleep', 'sleep']);
    expect(after.gameState?.players.opp.evidence).toHaveLength(2);
    expect(after.gameState?.players.opp.scene[0].turnEffects.lpMod_reasoning).toBeUndefined();
    expect(after.pendingMisread).toBeNull();
  });
});
