import { beforeEach, describe, expect, it } from 'vitest';
import { registerAll } from '@/cards';
import { applyPickAndContinuation, applyPickSkipAndContinuation } from '@/engine/effect/apply-pick';
import {
  _clearPendingEffectPickQueue,
  _drainPendingEffectPickSide,
} from '@/engine/effect/pending-state';
import { event } from '@/engine/event';
import { useDeclaredAbility } from '@/engine/flow/main/declared-ability';
import {
  _resetTriggeredRegistered,
  registerTriggeredListener,
} from '@/engine/listeners/triggered';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { read } from '@/engine/read';
import { _resetRegistry, register } from '@/engine/read/def';
import { runAllUntilEmpty } from '@/engine/resolve';
import { createEmptyGameState } from '@/engine/state-factory';
import type { CardDef, GameState } from '@/engine/types';
import { sceneChar } from '../helpers/fixtures';

const targetDef: CardDef = {
  id: 'WHITE-TARGET', no: 'fixture', kind: 'character', names: ['対象'], colors: ['白'],
  level: 2, ap: 3000, lp: 1, traits: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
};
const setDef: CardDef = {
  ...targetDef, id: 'SET-SOURCE', no: 'fixture-set', names: ['セット元'], colors: ['青'],
};

beforeEach(() => {
  event._resetRegistry();
  _resetTriggeredRegistered();
  _resetRegistry();
  _resetUidCounter();
  _clearPendingEffectPickQueue();
  registerAll();
  register(targetDef);
  register(setDef);
  registerTriggeredListener();
  (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
});

function state(cardId: string, player: 'self' | 'opp' = 'self'): GameState {
  const s = createEmptyGameState();
  s.turn = { number: 5, player, phase: 'main', isFirstPlayerFirstTurn: false };
  s.players[player].scene = [sceneChar(cardId, 'actor'), sceneChar('WHITE-TARGET', 'target')];
  s.players[player].deck = ['FILLER', 'SET-SOURCE'];
  return s;
}

function resolvePendingTarget(s: GameState, expectedCardName = '対象'): void {
  runAllUntilEmpty(s);
  const pending = _drainPendingEffectPickSide();
  expect(pending, 'real card effect must surface a human pick').not.toBeNull();
  expect(pending?.continuation, 'sequence rider must be attached to the pending carrier').toBeDefined();
  applyPickAndContinuation(s, pending!, 'target');
  const targetPlayer = pending!.candidates.find(candidate => candidate.uid === 'target')!.player;
  expect(pending!.continuation?.ctx.bindings['$picked'], 'human carrier must write the selected char binding').toEqual([
    { kind: 'char', uid: 'target', cardId: 'WHITE-TARGET', cardName: expectedCardName, player: targetPlayer },
  ]);
}

describe('BUG-130/158 live human carrier reuse', () => {
  for (const id of ['B02040', 'B02040P'] as const) {
    it(`${id} declared ability sets and buffs the same picked character`, () => {
      const s = state(id);
      useDeclaredAbility(s, 'actor', 'a2');
      resolvePendingTarget(s);
      expect(read.char.setCards(s, 'target')).toHaveLength(1);
      expect(read.char.ap(s, 'target')).toBe(5000);
    });
  }

  for (const id of ['B02046', 'B02046P', 'PR049'] as const) {
    it(`${id} enter trigger sets and buffs the same picked character`, () => {
      const s = state(id);
      event.emit(
        s,
        'enter',
        { uid: 'actor', player: 'self', viaEffect: false },
        { player: 'self', uid: 'actor', cardId: id },
      );
      resolvePendingTarget(s);
      expect(read.char.setCards(s, 'target')).toHaveLength(1);
      expect(read.char.ap(s, 'target')).toBe(4000);
    });
  }

  it('binds the current turn name override instead of the printed name', () => {
    const s = state('B02046');
    const target = s.players.self.scene.find(char => char.uid === 'target')!;
    target.turnEffects.nameOverride = '江戸川コナン';
    event.emit(
      s,
      'enter',
      { uid: 'actor', player: 'self', viaEffect: false },
      { player: 'self', uid: 'actor', cardId: 'B02046' },
    );
    resolvePendingTarget(s, '江戸川コナン');
  });

  it('declining the optional pick neither sets nor applies the rider', () => {
    const s = state('B02046');
    event.emit(s, 'enter', { uid: 'actor', player: 'self' }, { player: 'self', uid: 'actor', cardId: 'B02046' });
    runAllUntilEmpty(s);
    const pending = _drainPendingEffectPickSide();
    expect(pending?.nMin).toBe(0);
    applyPickSkipAndContinuation(s, pending!, false);
    expect(read.char.setCards(s, 'target')).toHaveLength(0);
    expect(read.char.ap(s, 'target')).toBe(3000);
  });

  it('keeps the same binding and rider semantics when the human owner is opp', () => {
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'opp';
    const s = state('B02046', 'opp');
    event.emit(s, 'enter', { uid: 'actor', player: 'opp' }, { player: 'opp', uid: 'actor', cardId: 'B02046' });
    resolvePendingTarget(s);
    expect(read.char.setCards(s, 'target')).toHaveLength(1);
    expect(read.char.ap(s, 'target')).toBe(4000);
  });
});
