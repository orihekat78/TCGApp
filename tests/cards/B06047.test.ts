import { beforeEach, describe, expect, it } from 'vitest';
import { B06047 } from '@/cards/ct-p06/B06047';
import { B06034 } from '@/cards/ct-p06/B06034';
import { B06062 } from '@/cards/ct-p06/B06062';
import { B06062P } from '@/cards/ct-p06/B06062P';
import { B06063 } from '@/cards/ct-p06/B06063';
import { B06063P } from '@/cards/ct-p06/B06063P';
import { B06064 } from '@/cards/ct-p06/B06064';
import { B06064P } from '@/cards/ct-p06/B06064P';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { mutate } from '@/engine/mutate/index';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { produce } from '@/engine/produce';
import { _resetRegistry as resetDefRegistry, register } from '@/engine/read/def';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { createEmptyGameState } from '@/engine/state-factory';
import { effectiveHandLevel } from '@/engine/flow/main/hand-use-card';
import { matchOneFilter } from '@/engine/target/candidates';
import { registerAll } from '@/cards/index';
import type { CardDef, GameState } from '@/engine/types';

const TARGET: CardDef = {
  id: 'B06047_TARGET', no: 'test/B06047_TARGET', kind: 'character', names: ['YAIBA候補'],
  colors: ['白'], level: 5, ap: 1000, lp: 1, traits: ['YAIBA'], keywords: [],
  rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
};

const eventCard = (id: string, colors: string[], traits: string[]): CardDef => ({
  id, no: `test/${id}`, kind: 'event', names: [id], colors, level: 7,
  traits, keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
});
const MATCH_EVENT = eventCard('B06047_MATCH_EVENT', ['白'], ['YAIBA']);
const WRONG_COLOR = eventCard('B06047_WRONG_COLOR', ['緑'], ['YAIBA']);
const WRONG_TRAIT = eventCard('B06047_WRONG_TRAIT', ['白'], ['OTHER']);
const WRONG_KIND: CardDef = {
  ...TARGET, id: 'B06047_WRONG_KIND', no: 'test/B06047_WRONG_KIND', level: 7,
};
const COMPOSE_EVENT: CardDef = {
  ...MATCH_EVENT, id: 'B06047_COMPOSE_EVENT', no: 'test/B06047_COMPOSE_EVENT',
  abilities: [
    {
      id: 'override', type: 'continuous', scope: 'on-hand',
      continuousModifier: { lvlOverrideInHand: 6 },
      description: 'Hand level becomes 6.', ruleRefs: ['rules/19-special-rules.md'],
    },
    {
      id: 'delta', type: 'continuous', scope: 'on-hand',
      continuousModifier: { lvlDeltaInHand: -1 },
      description: 'Hand level -1.', ruleRefs: ['rules/19-special-rules.md'],
    },
  ],
};
const CONDITIONAL_SOURCE: CardDef = {
  ...TARGET, id: 'B06047_CONDITIONAL_SOURCE', no: 'test/B06047_CONDITIONAL_SOURCE',
  abilities: [{
    id: 'a1', type: 'continuous', scope: 'on-scene',
    condition: { kind: 'turn', player: 'self' },
    continuousModifier: {
      handLevelAura: { filter: { kind: 'event', color: '白', trait: 'YAIBA' }, delta: -1 },
    },
    description: 'Own-turn hand aura.', ruleRefs: ['rules/15-abilities-effects.md'],
  }],
};

beforeEach(() => {
  event._resetRegistry();
  _resetTriggeredRegistered();
  resetDefRegistry();
  _resetUidCounter();
  registerAll();
  register(TARGET);
  register(MATCH_EVENT);
  register(WRONG_COLOR);
  register(WRONG_TRAIT);
  register(WRONG_KIND);
  register(COMPOSE_EVENT);
  register(CONDITIONAL_SOURCE);
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
  it('declares the filtered hand-level aura and ships the YAIBA set-card clause', () => {
    expect(B06047).toMatchObject({ id: 'B06047', level: 8, traits: ['YAIBA'] });
    expect(B06047.abilities).toMatchObject([
      {
        id: 'a1', type: 'continuous', scope: 'on-scene',
        continuousModifier: {
          handLevelAura: { filter: { kind: 'event', color: '白', trait: 'YAIBA' }, delta: -1 },
        },
      },
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
  });

  it('stacks once per physical source and leaves wrong targets unchanged', () => {
    const one = produce(base('self'), draft => {
      mutate.scene.enter(draft, 'self', B06047.id, {});
      draft.players.self.hand = [MATCH_EVENT.id];
    });
    expect(effectiveHandLevel(one, 'self', MATCH_EVENT.id)).toBe(6);
    expect(effectiveHandLevel(one, 'self', WRONG_COLOR.id)).toBe(7);
    expect(effectiveHandLevel(one, 'self', WRONG_TRAIT.id)).toBe(7);
    expect(effectiveHandLevel(one, 'self', WRONG_KIND.id)).toBe(7);
    expect(effectiveHandLevel(one, 'self', B06047.id)).toBe(8);
    expect(matchOneFilter(one, MATCH_EVENT.id, { levelMax: 6 }, null, {
      kind: 'card', cardId: MATCH_EVENT.id, player: 'self', area: 'hand', index: 0,
    })).toBe(true);
    const noAura = produce(base('self'), draft => {
      draft.players.self.hand = [MATCH_EVENT.id];
    });
    expect(matchOneFilter(noAura, MATCH_EVENT.id, { levelMax: 6 }, null, {
      kind: 'card', cardId: MATCH_EVENT.id, player: 'self', area: 'hand', index: 0,
    })).toBe(false);

    const two = produce(one, draft => {
      mutate.scene.enter(draft, 'self', B06047.id, {});
    });
    expect(effectiveHandLevel(two, 'self', MATCH_EVENT.id)).toBe(5);
    expect(effectiveHandLevel(two, 'opp', MATCH_EVENT.id)).toBe(7);

    const disabled = produce(one, draft => {
      draft.players.self.scene[0]!.keywordOverrides.disabledOriginal = true;
    });
    expect(effectiveHandLevel(disabled, 'self', MATCH_EVENT.id)).toBe(7);

    const departed = produce(one, draft => {
      mutate.scene.removeToRemove(draft, draft.players.self.scene[0]!.uid, { cause: 'effect' });
    });
    expect(effectiveHandLevel(departed, 'self', MATCH_EVENT.id)).toBe(7);
  });

  it('preserves official YAIBA traits on every affected event printing', () => {
    expect([B06034, B06062, B06062P, B06063, B06063P, B06064, B06064P]
      .map(card => [card.id, card.traits])).toEqual([
      ['B06034', ['YAIBA']],
      ['B06062', ['YAIBA']],
      ['B06062P', ['YAIBA']],
      ['B06063', ['YAIBA']],
      ['B06063P', ['YAIBA']],
      ['B06064', ['YAIBA']],
      ['B06064P', ['YAIBA']],
    ]);
  });

  it('composes target override and delta before adding the scene aura', () => {
    const state = produce(base('self'), draft => {
      mutate.scene.enter(draft, 'self', B06047.id, {});
    });
    expect(effectiveHandLevel(state, 'self', COMPOSE_EVENT.id)).toBe(4);
  });

  it('honors a hand-level aura bearer condition from the bearer owner context', () => {
    const active = produce(base('self'), draft => {
      mutate.scene.enter(draft, 'self', CONDITIONAL_SOURCE.id, {});
    });
    expect(effectiveHandLevel(active, 'self', MATCH_EVENT.id)).toBe(6);
    const inactive = produce(active, draft => {
      draft.turn.player = 'opp';
    });
    expect(effectiveHandLevel(inactive, 'self', MATCH_EVENT.id)).toBe(7);
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
