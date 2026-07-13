import { beforeEach, describe, expect, it } from 'vitest';
import { B06046 } from '@/cards/ct-p06/B06046';
import { B06046P } from '@/cards/ct-p06/B06046P';
import { createEmptyGameState } from '@/engine/state-factory';
import { mutate } from '@/engine/mutate';
import { event } from '@/engine/event';
import { runAllUntilEmpty } from '@/engine/resolve';
import { endTurn } from '@/engine/flow/turn';
import { _drainAllEffectPicksForTest, applyOptionalAndContinuation } from '@/engine/effect/apply-pick';
import { _drainPendingEffectOptionalSide } from '@/engine/effect/pending-state';
import { register as registerCard, _resetRegistry } from '@/engine/read/def';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { sceneChar } from '../helpers/fixtures';
import type { CardDef } from '@/engine/types';

const card = (id: string, traits: string[]): CardDef => ({ id, no: id, kind: 'event', names: [id], colors: ['白'], traits, keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [] });

const yaibaCharacter = (id: string, level: number): CardDef => ({ id, no: id, kind: 'character', names: [id], colors: ['白'], level, ap: 3000, lp: 1, traits: ['YAIBA'], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [] });

beforeEach(() => { event._resetRegistry(); _resetTriggeredRegistered(); _resetRegistry(); [B06046, B06046P, card('YAIBA_UP', ['YAIBA']), card('OTHER', ['OTHER']), yaibaCharacter('YAIBA_LOW', 5), yaibaCharacter('YAIBA_HIGH', 6)].forEach(registerCard); registerTriggeredListener(); (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = null; });

describe('B06046 鉄刃 production dispatch', () => {
  it('activates only for its owner turn and a face-up YAIBA card set on its own host', () => {
    const s = createEmptyGameState();
    s.turn = { number: 2, player: 'opp', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.opp.scene = [sceneChar('B06046', 'opp-host', { state: 'sleep' })];
    mutate.char.setCard(s, 'opp-host', 'YAIBA_UP', true);
    runAllUntilEmpty(s);
    expect(s.players.opp.scene[0]!.state).toBe('active');
    s.players.opp.scene[0]!.state = 'sleep';
    mutate.char.setCard(s, 'opp-host', 'OTHER', true);
    runAllUntilEmpty(s);
    expect(s.players.opp.scene[0]!.state).toBe('sleep');
  });

  it('keeps twins structurally equal and fails the end-turn set gate after the host leaves', () => {
    expect({ ...B06046, id: '', no: '', rarity: '', imageUrl: '' }).toEqual({ ...B06046P, id: '', no: '', rarity: '', imageUrl: '' });
    const s = createEmptyGameState();
    s.turn = { number: 2, player: 'self', phase: 'end', isFirstPlayerFirstTurn: false };
    s.players.self.scene = [sceneChar('B06046', 'host', { setCards: [{ cardId: 'YAIBA_UP', faceUp: true }, { cardId: 'YAIBA_UP', faceUp: true }] })];
    mutate.scene.removeToRemove(s, 'host', { cause: 'effect' });
    event.emit(s, 'phase:end:start', { player: 'self' }, undefined);
    runAllUntilEmpty(s);
    expect(s.players.self.scene.some(c => c.cardId === 'B06046')).toBe(false);
  });

  it('endTurn optional accept discards then reanimates only a level-5 YAIBA character asleep', () => {
    const s = createEmptyGameState();
    s.turn = { number: 2, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.self.scene = [sceneChar('B06046', 'host', { setCards: [{ cardId: 'YAIBA_UP', faceUp: true }, { cardId: 'YAIBA_UP', faceUp: true }] })];
    s.players.self.hand = ['OTHER'];
    s.players.self.remove = ['YAIBA_LOW', 'YAIBA_HIGH'];
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';

    endTurn(s, 'self');
    runAllUntilEmpty(s);
    const optional = _drainPendingEffectOptionalSide();
    expect(optional, 'end-turn a2 optional').not.toBeNull();
    applyOptionalAndContinuation(s, optional!, true);
    _drainAllEffectPicksForTest(s);
    runAllUntilEmpty(s);
    _drainAllEffectPicksForTest(s);
    runAllUntilEmpty(s);

    const revived = s.players.self.scene.find(c => c.cardId === 'YAIBA_LOW');
    expect(revived?.state).toBe('sleep');
    expect(s.players.self.remove).toContain('OTHER');
    expect(s.players.self.remove).toContain('YAIBA_HIGH');
    expect(s.players.self.remove).not.toContain('YAIBA_LOW');
  });

  it('endTurn optional accept still discards when remove has no matching reanimate candidate', () => {
    const s = createEmptyGameState();
    s.turn = { number: 2, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.self.scene = [sceneChar('B06046', 'host', { setCards: [{ cardId: 'YAIBA_UP', faceUp: true }, { cardId: 'YAIBA_UP', faceUp: true }] })];
    s.players.self.hand = ['OTHER'];
    s.players.self.remove = ['YAIBA_HIGH'];
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';

    endTurn(s, 'self');
    runAllUntilEmpty(s);
    const optional = _drainPendingEffectOptionalSide();
    expect(optional).not.toBeNull();
    applyOptionalAndContinuation(s, optional!, true);
    _drainAllEffectPicksForTest(s);
    runAllUntilEmpty(s);
    _drainAllEffectPicksForTest(s);
    runAllUntilEmpty(s);

    expect(s.players.self.hand).toEqual([]);
    expect(s.players.self.remove).toEqual(expect.arrayContaining(['OTHER', 'YAIBA_HIGH']));
    expect(s.players.self.scene.some(c => c.cardId === 'YAIBA_HIGH')).toBe(false);
  });
});
