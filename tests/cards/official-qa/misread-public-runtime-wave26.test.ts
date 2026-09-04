// qa: card:B04038:6d5a65b9e083c8565478cceec3269781a67a936789441e6c196e107f90e2e8c8
// qa: card:B04079:6d5a65b9e083c8565478cceec3269781a67a936789441e6c196e107f90e2e8c8
// qa: card:B05012:6d5a65b9e083c8565478cceec3269781a67a936789441e6c196e107f90e2e8c8
// qa: card:B05073:6d5a65b9e083c8565478cceec3269781a67a936789441e6c196e107f90e2e8c8
// qa: card:B05080:6d5a65b9e083c8565478cceec3269781a67a936789441e6c196e107f90e2e8c8
// qa: card:B06007:6d5a65b9e083c8565478cceec3269781a67a936789441e6c196e107f90e2e8c8
// qa: card:B06030:6d5a65b9e083c8565478cceec3269781a67a936789441e6c196e107f90e2e8c8
// qa: card:B06056:6d5a65b9e083c8565478cceec3269781a67a936789441e6c196e107f90e2e8c8
// qa: card:B07045:6d5a65b9e083c8565478cceec3269781a67a936789441e6c196e107f90e2e8c8
// qa: card:B07073:6d5a65b9e083c8565478cceec3269781a67a936789441e6c196e107f90e2e8c8
// qa: card:B07086:6d5a65b9e083c8565478cceec3269781a67a936789441e6c196e107f90e2e8c8
// qa: card:B08011:6d5a65b9e083c8565478cceec3269781a67a936789441e6c196e107f90e2e8c8
// qa: card:B09016:6d5a65b9e083c8565478cceec3269781a67a936789441e6c196e107f90e2e8c8
// qa: card:B09063:6d5a65b9e083c8565478cceec3269781a67a936789441e6c196e107f90e2e8c8
// qa: card:B10016:6d5a65b9e083c8565478cceec3269781a67a936789441e6c196e107f90e2e8c8
// qa: card:B10040:6d5a65b9e083c8565478cceec3269781a67a936789441e6c196e107f90e2e8c8
// qa: card:B10045:6d5a65b9e083c8565478cceec3269781a67a936789441e6c196e107f90e2e8c8
// qa: card:PR247:6d5a65b9e083c8565478cceec3269781a67a936789441e6c196e107f90e2e8c8
// qa: card:PR262:6d5a65b9e083c8565478cceec3269781a67a936789441e6c196e107f90e2e8c8
// qa: card:PR268:6d5a65b9e083c8565478cceec3269781a67a936789441e6c196e107f90e2e8c8
// qa: card:B01045:b439f52112312a2dc0c944cc0f0aa531a2eda23b876e486679bd42f2af1b71b7
// qa: card:B01093:b439f52112312a2dc0c944cc0f0aa531a2eda23b876e486679bd42f2af1b71b7
// qa: card:B02060:b439f52112312a2dc0c944cc0f0aa531a2eda23b876e486679bd42f2af1b71b7
// qa: card:B02082:b439f52112312a2dc0c944cc0f0aa531a2eda23b876e486679bd42f2af1b71b7
// qa: card:B03009:b439f52112312a2dc0c944cc0f0aa531a2eda23b876e486679bd42f2af1b71b7
// qa: card:B03037:b439f52112312a2dc0c944cc0f0aa531a2eda23b876e486679bd42f2af1b71b7
// qa: card:B03053:b439f52112312a2dc0c944cc0f0aa531a2eda23b876e486679bd42f2af1b71b7
// qa: card:B03125:b439f52112312a2dc0c944cc0f0aa531a2eda23b876e486679bd42f2af1b71b7
// qa: card:D02009:b439f52112312a2dc0c944cc0f0aa531a2eda23b876e486679bd42f2af1b71b7
// qa: card:D03010:b439f52112312a2dc0c944cc0f0aa531a2eda23b876e486679bd42f2af1b71b7
// qa: card:D04008:b439f52112312a2dc0c944cc0f0aa531a2eda23b876e486679bd42f2af1b71b7
// qa: card:D05011:b439f52112312a2dc0c944cc0f0aa531a2eda23b876e486679bd42f2af1b71b7
// qa: card:D07016:b439f52112312a2dc0c944cc0f0aa531a2eda23b876e486679bd42f2af1b71b7
// qa: card:D07017:b439f52112312a2dc0c944cc0f0aa531a2eda23b876e486679bd42f2af1b71b7
// PR247/PR262/PR268 c61 normalized guidance bundles non-Misread text; those
// portions remain test-missing. This file proves only their Misread behavior.

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

describe('official QA Wave 26: Misread public authority and aggregation', () => {
  beforeEach(resetRuntime);

  const MISREAD_ONE_CASES = [
    'B04038', 'B04079', 'B05012', 'B05073', 'B05080', 'B06007', 'B06030', 'B06056', 'B07045', 'B07073',
    'B07086', 'B08011', 'B09016', 'B09063', 'B10016', 'B10040', 'B10045', 'PR262', 'PR268',
  ] as const;
  it.each(MISREAD_ONE_CASES)('%s applies Misread 1 alongside a second Misread', (cardId) => {
    install([cardId, 'B06093']);
    const pending = beginReasoning();
    expect(pending.candidates).toEqual([{ uid: 'misread-0', x: 1 }, { uid: 'misread-1', x: 2 }]);
    expect(dispatchCurrentDecision({ type: 'misreadResolve', picks: pending.candidates })).toEqual({ ok: true });
    const after = useGameStateStore.getState();
    expect(after.gameState?.players.self.scene.map((card) => card.state)).toEqual(['sleep', 'sleep']);
    expect(after.gameState?.players.opp.evidence).toHaveLength(2);
    expect(after.pendingMisread).toBeNull();
  });

  const MULTIPLE_CASES = [
    'B01045', 'B01093', 'B02060', 'B02082', 'B03009', 'B03037', 'B03053',
    'B03125', 'D02009', 'D03010', 'D04008', 'D05011', 'D07016', 'D07017',
  ] as const;
  it.each(MULTIPLE_CASES)('%s combines with another Misread in one decision', (cardId) => {
    install([cardId, 'B06093']);
    const pending = beginReasoning();
    expect(pending.candidates).toEqual([{ uid: 'misread-0', x: 1 }, { uid: 'misread-1', x: 2 }]);
    expect(dispatchCurrentDecision({ type: 'misreadResolve', picks: pending.candidates })).toEqual({ ok: true });
    const after = useGameStateStore.getState();
    expect(after.gameState?.players.self.scene.map((card) => card.state)).toEqual(['sleep', 'sleep']);
    expect(after.gameState?.players.opp.evidence).toHaveLength(2);
    expect(after.pendingMisread).toBeNull();
  });

  const PHYSICAL_VARIANTS = [
    ['B06007P', 1], ['B06030P', 1], ['B07073P', 1], ['B10071P', 3],
  ] as const;
  it.each(PHYSICAL_VARIANTS)('%s preserves the printed Misread %i value', (cardId, x) => {
    install([cardId, 'B06093']);
    const pending = beginReasoning();
    expect(pending.candidates).toEqual([{ uid: 'misread-0', x }, { uid: 'misread-1', x: 2 }]);
    expect(dispatchCurrentDecision({ type: 'misreadResolve', picks: pending.candidates })).toEqual({ ok: true });
    const after = useGameStateStore.getState();
    expect(after.gameState?.players.self.scene.map((card) => card.state)).toEqual(['sleep', 'sleep']);
    expect(after.gameState?.players.opp.evidence).toHaveLength(Math.max(0, 3 - x));
  });

  it('keeps PR247 inert while resolving the generic Misread FAQs with real cards', () => {
    install(['PR247', 'B04079', 'B06093']);
    const pending = beginReasoning();
    expect(pending.candidates).toEqual([{ uid: 'misread-1', x: 1 }, { uid: 'misread-2', x: 2 }]);
    expect(dispatchCurrentDecision({ type: 'misreadResolve', picks: pending.candidates })).toEqual({ ok: true });
    const after = useGameStateStore.getState();
    expect(after.gameState?.players.self.scene.map((card) => card.state)).toEqual(['active', 'sleep', 'sleep']);
    expect(after.gameState?.players.opp.evidence).toHaveLength(2);
    expect(after.pendingMisread).toBeNull();
  });
});
