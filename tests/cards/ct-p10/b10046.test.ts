import { beforeEach, describe, expect, it } from 'vitest';
import { REUSE_CARDS } from '@/cards';
import { B10046 } from '@/cards/ct-p10/B10046';
import { event } from '@/engine/event';
import { applyChoiceAndContinuation, applyPickAndContinuation, applyPickSkipAndContinuation, drainAiEffectPicks } from '@/engine/effect/apply-pick';
import { _clearPendingEffectChoiceSide, _clearPendingEffectPickQueue, _drainPendingEffectChoiceSide, _drainPendingEffectPickSide } from '@/engine/effect/pending-state';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { mutate } from '@/engine/mutate';
import { _resetRegistry, register } from '@/engine/read/def';
import { runAllUntilEmpty } from '@/engine/resolve';
import { createEmptyGameState } from '@/engine/state-factory';
import type { CardDef, GameState } from '@/engine/types';
import { sceneChar } from '../../helpers/fixtures';

const KAITO: CardDef = {
  id: 'KAITO', no: 'KAITO', kind: 'character', names: ['怪盗キッド'], colors: ['白'], level: 5, ap: 5000, lp: 1,
  traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
};
const GEM: CardDef = {
  id: 'GEM', no: 'GEM', kind: 'event', names: ['Big Jewel Event'], colors: ['白'],
  traits: ['ビッグジュエル'], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
};
const DECOY: CardDef = {
  id: 'DECOY', no: 'DECOY', kind: 'event', names: ['Decoy Event'], colors: ['白'],
  traits: ['別特徴'], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
};

const globals = globalThis as { __humanPlayerSide?: 'self' | 'opp' | null };

function state(withKaito = true): GameState {
  const value = createEmptyGameState();
  value.turn = { number: 4, player: 'self', phase: 'end', isFirstPlayerFirstTurn: false };
  value.players.self.scene = [sceneChar('B10046', 'host'), ...(withKaito ? [sceneChar('KAITO', 'kaito')] : [])];
  value.players.self.remove = ['GEM', 'DECOY', 'GEM'];
  return value;
}

function emitTurnEnd(value: GameState): void {
  event.emit(value, 'phase:end:start', { player: 'self' }, undefined);
}

function resolveHumanPick(value: GameState, gemIndex: number): void {
  runAllUntilEmpty(value);
  const pending = _drainPendingEffectPickSide();
  expect(pending?.atomVerb).toBe('bindPick');
  expect(pending?.candidates.map((candidate) => candidate.cardId)).toEqual(['GEM', 'GEM']);
  applyPickAndContinuation(value, pending!, pending!.candidates[gemIndex]!.uid);
}

beforeEach(() => {
  globals.__humanPlayerSide = 'self';
  event._resetRegistry();
  _resetTriggeredRegistered();
  _resetRegistry();
  _clearPendingEffectPickQueue();
  _clearPendingEffectChoiceSide();
  [B10046, KAITO, GEM, DECOY].forEach(register);
  registerTriggeredListener();
});

describe('B10046 山本萌奈', () => {
  it('matches metadata and defers the Kaito check to effect resolution', () => {
    expect(REUSE_CARDS.filter((card) => card.id === 'B10046')).toEqual([B10046]);
    expect(B10046).toMatchObject({
      id: 'B10046', no: '1106/B10046', kind: 'character', names: ['山本萌奈'], colors: ['白'],
      level: 4, ap: 4000, lp: 1, traits: ['会社員'], rarity: 'C', imageUrl: '1783904138044438.jpg',
      abilities: [{ trigger: { hook: 'phase:end:start' }, condition: { kind: 'turn', player: 'self' } }],
    });
    expect(B10046.abilities[0]!.effect).toMatchObject({
      kind: 'conditional',
      if: { kind: 'sceneHas', query: { area: 'scene', side: 'self', filter: { cardName: '怪盗キッド' } }, nMin: 1 },
    });
  });

  it('rechecks Kaito when it enters after triggering, and excludes the decoy event', () => {
    const value = state(false);
    emitTurnEnd(value);
    value.players.self.scene.push(sceneChar('KAITO', 'kaito'));

    resolveHumanPick(value, 0);
    expect(_drainPendingEffectChoiceSide()?.options).toHaveLength(2);
  });

  it('does not resolve after Kaito leaves between trigger and resolution', () => {
    const value = state();
    emitTurnEnd(value);
    mutate.scene.removeToRemove(value, 'kaito', { cause: 'effect' });
    runAllUntilEmpty(value);

    expect(_drainPendingEffectPickSide()).toBeNull();
    expect(value.players.self.remove).toEqual(['GEM', 'DECOY', 'GEM', 'KAITO']);
  });

  it('still resolves after the source has left, if Kaito remains', () => {
    const value = state();
    emitTurnEnd(value);
    mutate.scene.removeToRemove(value, 'host', { cause: 'effect' });

    resolveHumanPick(value, 0);
    expect(_drainPendingEffectChoiceSide()).not.toBeNull();
  });

  it('allows selecting zero cards without opening a destination choice', () => {
    const value = state();
    runAllUntilEmpty(value);
    emitTurnEnd(value);
    runAllUntilEmpty(value);
    const pending = _drainPendingEffectPickSide();
    expect(pending?.atomVerb).toBe('bindPick');
    applyPickSkipAndContinuation(value, pending!);

    expect(_drainPendingEffectChoiceSide()).toBeNull();
    expect(value.players.self.remove).toEqual(['GEM', 'DECOY', 'GEM']);
  });

  it('moves the selected duplicate to partner area, preserving its selected occurrence', () => {
    const value = state();
    emitTurnEnd(value);
    resolveHumanPick(value, 1);
    applyChoiceAndContinuation(value, _drainPendingEffectChoiceSide()!, 0);
    runAllUntilEmpty(value);

    expect(value.players.self.remove).toEqual(['GEM', 'DECOY']);
    expect(value.players.self.partnerAreaCards).toEqual(['GEM']);
    expect(value.players.self.hand).toEqual([]);
  });

  it('moves the selected duplicate to hand, preserving its selected occurrence', () => {
    const value = state();
    emitTurnEnd(value);
    resolveHumanPick(value, 1);
    applyChoiceAndContinuation(value, _drainPendingEffectChoiceSide()!, 1);
    runAllUntilEmpty(value);

    expect(value.players.self.remove).toEqual(['GEM', 'DECOY']);
    expect(value.players.self.hand).toEqual(['GEM']);
    expect(value.players.self.partnerAreaCards ?? []).toEqual([]);
  });

  it('fizzles the destination after the chosen occurrence is replaced during its choice', () => {
    const value = state();
    emitTurnEnd(value);
    resolveHumanPick(value, 1);
    mutate.remove.removeFromHere(value, 'self', ['GEM']);
    mutate.remove.add(value, 'self', ['GEM']);

    applyChoiceAndContinuation(value, _drainPendingEffectChoiceSide()!, 1);
    runAllUntilEmpty(value);

    expect(value.players.self.remove).toEqual(['DECOY', 'GEM', 'GEM']);
    expect(value.players.self.hand).toEqual([]);
    expect(value.players.self.partnerAreaCards ?? []).toEqual([]);
  });

  it('uses the AI path to select an eligible event and choose partner area', () => {
    globals.__humanPlayerSide = null;
    const value = state();
    emitTurnEnd(value);
    for (let i = 0; i < 4; i++) {
      runAllUntilEmpty(value);
      drainAiEffectPicks(value);
    }

    expect(value.players.self.partnerAreaCards).toEqual(['GEM']);
    expect(value.players.self.remove).toEqual(['DECOY', 'GEM']);
  });
});
