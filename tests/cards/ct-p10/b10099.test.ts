import { beforeEach, describe, expect, it } from 'vitest';
import { B10099, B10099P } from '@/cards/ct-p10/B10099';
import { REUSE_CARDS } from '@/cards';
import { applyOptionalAndContinuation, applyPickAndContinuation } from '@/engine/effect/apply-pick';
import { _clearPendingEffectOptionalSide, _clearPendingEffectPickQueue, _drainPendingEffectOptionalSide, _drainPendingEffectPickSide } from '@/engine/effect/pending-state';
import { event } from '@/engine/event';
import { _resetTriggeredRegistered, _setHumanPlayerSide, registerTriggeredListener } from '@/engine/listeners/triggered';
import { mutate } from '@/engine/mutate';
import { _resetRegistry, register } from '@/engine/read/def';
import { char as readChar } from '@/engine/read/char';
import { runAllUntilEmpty } from '@/engine/resolve';
import { createEmptyGameState } from '@/engine/state-factory';
import { sceneChar } from '../../helpers/fixtures';
import type { CardDef, GameState } from '@/engine/types';

const VANILLA: CardDef = { id: 'B10099_VANILLA', no: 'B10099_VANILLA', kind: 'character', names: ['Vanilla'], colors: ['赤'], level: 5, ap: 1000, lp: 1, traits: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [] };
const TARGET: CardDef = { ...VANILLA, id: 'B10099_TARGET', no: 'B10099_TARGET', level: 6 };
const ICON_ONLY: CardDef = { ...VANILLA, id: 'B10099_ICON_ONLY', no: 'B10099_ICON_ONLY', abilities: [{ id: 'cutin', type: 'triggered', scope: 'on-hand', trigger: { hook: 'effect:declared', optional: true, selfOnly: true }, effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 0 } }, description: '【カットイン】', ruleRefs: [] }] };

function state(): GameState {
  const value = createEmptyGameState();
  value.turn = { number: 4, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  value.players.self.scene.push(sceneChar(B10099.id, 'host'));
  return value;
}

function enter(value: GameState, uid: string): void {
  event.emit(value, 'enter', { uid, viaEffect: false, enterOrder: 1 }, { player: 'self', uid, cardId: value.players.self.scene.find(char => char.uid === uid)?.cardId });
}

beforeEach(() => {
  event._resetRegistry();
  _resetTriggeredRegistered();
  _resetRegistry();
  _clearPendingEffectOptionalSide();
  _clearPendingEffectPickQueue();
  _setHumanPlayerSide('self');
  [B10099, B10099P, VANILLA, TARGET, ICON_ONLY].forEach(register);
  registerTriggeredListener();
});

describe('B10099 赤井秀一＆安室透', () => {
  it('keeps official metadata, P-equivalence, partner-area trigger scope, aura, and cut-in', () => {
    expect(B10099).toMatchObject({ id: 'B10099', no: '1154/B10099', names: ['赤井秀一＆安室透', '赤井秀一', '安室透'], colors: ['赤', '黄'], level: 9, ap: 8000, lp: 2, rarity: 'MR', imageUrl: '1783904232432220.jpg' });
    expect(B10099P).toMatchObject({ id: 'B10099P', no: '1154/B10099P', rarity: 'MRP', imageUrl: '1783904232439228.jpg' });
    expect(B10099P.abilities).toEqual(B10099.abilities);
    expect(REUSE_CARDS.filter(card => card.id === B10099.id || card.id === B10099P.id)).toEqual([B10099, B10099P]);
    expect(new Set(REUSE_CARDS.map(card => card.id)).size).toBe(REUSE_CARDS.length);
    expect(B10099.abilities[0]).toMatchObject({ type: 'continuous', scope: 'on-partner-area', continuousModifier: { lvlDeltaAuraOpp: -1 } });
    expect(B10099.abilities[2]).toMatchObject({ scope: 'on-partner-area', limit: { kind: 'turn', n: 2 } });
    expect(B10099.abilities[3]).toMatchObject({ scope: 'on-hand', trigger: { hook: 'effect:declared', optional: true, selfOnly: true } });
  });

  it('binds two simultaneous enter events independently and keeps the queue JSON-safe', () => {
    const value = state();
    value.players.self.scene.push(sceneChar(VANILLA.id, 'first'), sceneChar(ICON_ONLY.id, 'second'));
    enter(value, 'first');
    enter(value, 'second');

    const entries = value.pendingEffects.filter(entry => entry.source.abilityId === 'a3');
    expect(entries).toHaveLength(2);
    expect(entries.map(entry => entry.bindings?.$triggerChar?.[0])).toEqual([
      { kind: 'char', uid: 'first', cardId: VANILLA.id, player: 'self' },
      { kind: 'char', uid: 'second', cardId: ICON_ONLY.id, player: 'self' },
    ]);
    expect(() => JSON.stringify(entries)).not.toThrow();
  });

  it('consumes both turn uses for an already-sleep entrant and an optional decline', () => {
    const value = state();
    value.players.self.scene.push(sceneChar(VANILLA.id, 'sleeping', { state: 'sleep' }), sceneChar(VANILLA.id, 'declined'), sceneChar(VANILLA.id, 'third'));
    enter(value, 'sleeping');
    runAllUntilEmpty(value);
    applyOptionalAndContinuation(value, _drainPendingEffectOptionalSide()!, true);
    runAllUntilEmpty(value);
    expect(_drainPendingEffectPickSide()).toBeNull();

    enter(value, 'declined');
    runAllUntilEmpty(value);
    applyOptionalAndContinuation(value, _drainPendingEffectOptionalSide()!, false);
    runAllUntilEmpty(value);
    const consumed = value.pendingEffects.filter(entry => entry.source.abilityId === 'a3').length;
    enter(value, 'third');
    expect(value.pendingEffects.filter(entry => entry.source.abilityId === 'a3')).toHaveLength(consumed);
  });

  it('fails closed after the entrant leaves before resolution', () => {
    const value = state();
    value.players.self.scene.push(sceneChar(VANILLA.id, 'entrant'), sceneChar(TARGET.id, 'target'));
    enter(value, 'entrant');
    mutate.scene.removeToRemove(value, 'entrant', 'effect');
    runAllUntilEmpty(value);
    applyOptionalAndContinuation(value, _drainPendingEffectOptionalSide()!, true);
    runAllUntilEmpty(value);
    expect(value.players.self.scene.some(char => char.uid === 'target')).toBe(true);
    expect(_drainPendingEffectPickSide()).toBeNull();
  });

  it('re-reads the entrant effective level when resolving the removal bound', () => {
    const value = state();
    value.players.self.scene.push(
      sceneChar(VANILLA.id, 'entrant', { turnEffects: { contactImmune: false, removeOnTurnEnd: false, lvlMod_turn: 2 } }),
      sceneChar(TARGET.id, 'target'),
    );
    enter(value, 'entrant');
    expect(readChar.level(value, 'entrant')).toBe(7);
    runAllUntilEmpty(value);
    applyOptionalAndContinuation(value, _drainPendingEffectOptionalSide()!, true);
    runAllUntilEmpty(value);
    const pick = _drainPendingEffectPickSide();
    expect(pick?.candidates.map(candidate => candidate.uid)).toContain('target');
    applyPickAndContinuation(value, pick!, pick!.candidates.find(candidate => candidate.uid === 'target')!.uid);
    runAllUntilEmpty(value);
    expect(value.players.self.scene.some(char => char.uid === 'target')).toBe(false);
  });
});
