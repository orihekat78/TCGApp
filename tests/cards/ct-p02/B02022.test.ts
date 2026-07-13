// tests/cards/ct-p02/B02022 — 鬼丸猛: action 宣言の一回限り強制指定

import { beforeEach, describe, expect, it } from 'vitest';
import { engine } from '@/engine';
import { produce } from '@/engine/produce';
import { createEmptyGameState } from '@/engine/state-factory';
import { B02022 } from '@/cards/ct-p02/B02022';
import { B02022P } from '@/cards/ct-p02/B02022P';
import type { CardDef } from '@/engine/types';
import { sceneChar } from '../../helpers/fixtures';

const OTHER: CardDef = {
  id: 'OTHER', no: 'test/OTHER', kind: 'character', names: ['Other'],
  colors: ['青'], level: 1, ap: 1000, lp: 0, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [],
};

describe('B02022 鬼丸猛', () => {
  beforeEach(() => {
    engine.cards._resetRegistry();
    engine.cards.register(B02022);
    engine.cards.register(OTHER);
  });

  it('first opposing action must target a legal B02022, then all copies are consumed only on declaration', () => {
    let s = produce(createEmptyGameState(), (d) => {
      d.turn.player = 'opp';
      d.turn.number = 7;
      d.players.opp.scene.push(sceneChar('OTHER', 'attacker', { state: 'active' }));
      d.players.self.scene.push(sceneChar('B02022', 'onimaru-a', { state: 'sleep' }));
      d.players.self.scene.push(sceneChar('B02022', 'onimaru-b', { state: 'stun' }));
      d.players.self.scene.push(sceneChar('OTHER', 'other-target', { state: 'sleep' }));
      d.players.self.evidence.push('evidence');
    });

    // UI/AI preview is a pure read: it may run repeatedly without consuming 【ターン1】.
    expect(engine.flow.canActionAgainstChar(s, 'attacker', 'other-target')).toBe(false);
    expect(engine.flow.canActionAgainstChar(s, 'attacker', 'other-target')).toBe(false);
    expect(engine.flow.canActionAgainstCase(s, 'attacker', 'self')).toBe(false);

    expect(() => engine.flow.action.declare(s, 'attacker', { kind: 'char', uid: 'other-target' })).toThrow(/cannot action/i);
    s = produce(s, (d) => { engine.flow.action.declare(d, 'attacker', { kind: 'char', uid: 'onimaru-a' }); });

    expect(s.players.self.scene.find(c => c.uid === 'onimaru-a')?.turnEffects.mustTargetSelfOnce).toBe(7);
    expect(s.players.self.scene.find(c => c.uid === 'onimaru-b')?.turnEffects.mustTargetSelfOnce).toBe(7);
  });

  it('partner action ignores B02022 and does not consume it', () => {
    let s = produce(createEmptyGameState(), (d) => {
      d.turn.player = 'opp';
      d.turn.number = 9;
      d.players.opp.partner = { cardId: 'OTHER', state: 'active', location: 'partner-area' };
      d.players.self.scene.push(sceneChar('B02022', 'onimaru', { state: 'sleep' }));
      d.players.self.evidence.push('evidence');
    });

    expect(engine.flow.canActionAgainstCase(s, 'partner:opp', 'self')).toBe(true);
    s = produce(s, (d) => { engine.flow.action.declare(d, 'partner:opp', { kind: 'case', player: 'self' }); });
    expect(s.players.self.scene.find(c => c.uid === 'onimaru')?.turnEffects.mustTargetSelfOnce).toBeUndefined();
  });

  it('when B02022 is not a legal character target, a scene character may action against the case', () => {
    let s = produce(createEmptyGameState(), (d) => {
      d.turn.player = 'opp';
      d.turn.number = 10;
      d.players.opp.scene.push(sceneChar('OTHER', 'attacker', { state: 'active' }));
      d.players.self.scene.push(sceneChar('B02022', 'onimaru', { state: 'active' }));
      d.players.self.evidence.push('evidence');
    });

    expect(engine.flow.canActionAgainstCase(s, 'attacker', 'self')).toBe(true);
    s = produce(s, (d) => { engine.flow.action.declare(d, 'attacker', { kind: 'case', player: 'self' }); });
    expect(s.players.self.scene.find(c => c.uid === 'onimaru')?.turnEffects.mustTargetSelfOnce).toBe(10);
  });

  it('an active B02022 does not force a target, but its once-per-turn trigger is consumed by the action declaration', () => {
    let s = produce(createEmptyGameState(), (d) => {
      d.turn.player = 'opp';
      d.turn.number = 8;
      d.players.opp.scene.push(sceneChar('OTHER', 'attacker', { state: 'active' }));
      d.players.self.scene.push(sceneChar('B02022', 'onimaru', { state: 'active' }));
      d.players.self.scene.push(sceneChar('OTHER', 'other-target', { state: 'sleep' }));
    });

    expect(engine.flow.canActionAgainstChar(s, 'attacker', 'other-target')).toBe(true);
    s = produce(s, (d) => { engine.flow.action.declare(d, 'attacker', { kind: 'char', uid: 'other-target' }); });
    expect(s.players.self.scene.find(c => c.uid === 'onimaru')?.turnEffects.mustTargetSelfOnce).toBe(8);
  });

  it('P printing is the exact text/ability twin', () => {
    expect(B02022P.abilities).toBe(B02022.abilities);
    expect(B02022P.id).toBe('B02022P');
    expect(B02022P.imageUrl).not.toBe(B02022.imageUrl);
  });
});
