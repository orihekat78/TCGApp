import { beforeEach, describe, expect, it } from 'vitest';
import { B06047 } from '@/cards/ct-p06/B06047';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { mutate } from '@/engine/mutate/index';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { produce } from '@/engine/produce';
import { _resetRegistry as resetDefRegistry, register } from '@/engine/read/def';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { createEmptyGameState } from '@/engine/state-factory';
import { effectiveHandLevel } from '@/engine/flow/main/hand-use-card';
import { registerAll } from '@/cards/index';
import type { CardDef, GameState } from '@/engine/types';

const TARGET: CardDef = {
  id: 'B06047_TARGET', no: 'test/B06047_TARGET', kind: 'character', names: ['YAIBA候補'],
  colors: ['白'], level: 5, ap: 1000, lp: 1, traits: ['YAIBA'], keywords: [],
  rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
};

beforeEach(() => {
  event._resetRegistry();
  _resetTriggeredRegistered();
  resetDefRegistry();
  _resetUidCounter();
  registerAll();
  register(TARGET);
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
  it('keeps the deferred hand aura inert and ships the YAIBA set-card clause', () => {
    expect(B06047).toMatchObject({ id: 'B06047', level: 8, traits: ['YAIBA'] });
    expect(B06047.abilities).toMatchObject([
      { id: 'a1', type: 'continuous', scope: 'on-scene' },
      {
        type: 'triggered', condition: { kind: 'turn', player: 'self' },
        limit: { kind: 'turn', n: 1 },
        trigger: {
          hook: 'setcard:enter', selfOnly: true,
          matcherCondition: { kind: 'setCardMatches', filter: { trait: 'YAIBA' } },
        },
        effect: { kind: 'atom', verb: 'sceneEnter' },
      },
    ]);
    expect(B06047.abilities[0]?.continuousModifier).toBeUndefined();
  });

  it('does not misapply its deferred event-level aura to B06047 itself', () => {
    const s = base('self');
    expect(effectiveHandLevel(s, 'self', 'B06047')).toBe(8);
  });

  it.each(['self', 'opp'] as const)('%s owner enters one sleeping YAIBA when a YAIBA card is set during its turn', (owner) => {
    let s = base(owner);
    let hostUid = '';
    s = produce(s, (d) => {
      hostUid = mutate.scene.enter(d, owner, 'B06047', {}).uid;
      d.players[owner].remove = [TARGET.id];
    });
    const after = produce(s, (d) => {
      mutate.char.setCard(d, hostUid, 'B06047', true);
      runAllUntilEmpty(d);
    });
    expect(after.players[owner].scene.find(card => card.cardId === TARGET.id)?.state).toBe('sleep');
    expect(after.players[owner].remove).toEqual([]);
  });

  it('rejects face-down, non-YAIBA, and opponent-turn set triggers', () => {
    const fire = (turn: 'self' | 'opp', setCardId: string, faceUp: boolean) => {
      let s = base(turn);
      let hostUid = '';
      s = produce(s, (d) => {
        hostUid = mutate.scene.enter(d, 'self', 'B06047', {}).uid;
        d.players.self.remove = [TARGET.id];
      });
      const after = produce(s, (d) => { mutate.char.setCard(d, hostUid, setCardId, faceUp); runAllUntilEmpty(d); });
      return after.players.self.scene.some(card => card.cardId === TARGET.id);
    };
    expect(fire('self', 'B06047', false)).toBe(false);
    expect(fire('self', 'B01001', true)).toBe(false);
    expect(fire('opp', 'B06047', true)).toBe(false);
  });

  it('uses the printed turn-one limit across repeated qualifying sets', () => {
    let state = base('self');
    let hostUid = '';
    state = produce(state, draft => {
      hostUid = mutate.scene.enter(draft, 'self', B06047.id, {}).uid;
      draft.players.self.remove = [TARGET.id, TARGET.id];
    });
    const after = produce(state, draft => {
      mutate.char.setCard(draft, hostUid, B06047.id, true);
      runAllUntilEmpty(draft);
      mutate.char.setCard(draft, hostUid, B06047.id, true);
      runAllUntilEmpty(draft);
    });
    expect(after.players.self.scene.filter(card => card.cardId === TARGET.id)).toHaveLength(1);
    expect(after.players.self.remove).toEqual([TARGET.id]);
  });
});
