import { beforeEach, describe, expect, it } from 'vitest';
import { B06047 } from '@/cards/ct-p06/B06047';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { mutate } from '@/engine/mutate/index';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { produce } from '@/engine/produce';
import { _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { createEmptyGameState } from '@/engine/state-factory';
import { effectiveHandLevel } from '@/engine/flow/main/hand-use-card';
import { registerAll } from '@/cards/index';
import type { GameState } from '@/engine/types';

beforeEach(() => {
  event._resetRegistry();
  _resetTriggeredRegistered();
  resetDefRegistry();
  _resetUidCounter();
  registerAll();
  registerTriggeredListener();
});

function base(turn: 'self' | 'opp'): GameState {
  return produce(createEmptyGameState(), (d) => {
    d.turn.player = turn;
    d.players.self.deck = ['S1', 'S2'];
    d.players.opp.deck = ['O1', 'O2'];
  });
}

describe('B06047 鉄刃', () => {
  it('has its printed hand-level and YAIBA set-card clauses', () => {
    expect(B06047).toMatchObject({ id: 'B06047', level: 8, traits: ['YAIBA'] });
    expect(B06047.abilities).toMatchObject([
      { type: 'continuous', scope: 'on-hand', continuousModifier: { lvlDeltaInHand: -1 } },
      { type: 'triggered', condition: { kind: 'turn', player: 'self' }, trigger: { hook: 'setcard:enter', selfOnly: true, matcherCondition: { kind: 'setCardMatches', filter: { trait: 'YAIBA' } } } },
    ]);
  });

  it('is level 7 only while in hand', () => {
    const s = base('self');
    expect(effectiveHandLevel(s, 'self', 'B06047')).toBe(7);
  });

  it.each(['self', 'opp'] as const)('%s owner draws when a face-up YAIBA card is set during its turn', (owner) => {
    let s = base(owner);
    let hostUid = '';
    s = produce(s, (d) => { hostUid = mutate.scene.enter(d, owner, 'B06047', {}).uid; });
    const before = s.players[owner].hand.length;
    const after = produce(s, (d) => {
      mutate.char.setCard(d, hostUid, 'B06047', true);
      runAllUntilEmpty(d);
    });
    expect(after.players[owner].hand.length).toBe(before + 1);
  });

  it('does not draw for a face-down or non-YAIBA set card, or on the opponent turn', () => {
    const fire = (turn: 'self' | 'opp', setCardId: string, faceUp: boolean) => {
      let s = base(turn);
      let hostUid = '';
      s = produce(s, (d) => { hostUid = mutate.scene.enter(d, 'self', 'B06047', {}).uid; });
      const before = s.players.self.hand.length;
      const after = produce(s, (d) => { mutate.char.setCard(d, hostUid, setCardId, faceUp); runAllUntilEmpty(d); });
      return after.players.self.hand.length - before;
    };
    expect(fire('self', 'B06047', false)).toBe(0);
    expect(fire('self', 'B01001', true)).toBe(0);
    expect(fire('opp', 'B06047', true)).toBe(0);
  });
});
