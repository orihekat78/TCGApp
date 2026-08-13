import { beforeEach, describe, expect, it } from 'vitest';

import { B05035 } from '@/cards/ct-p05/B05035';
import { PR099 } from '@/cards/pr-01/PR099';
import { PR105 } from '@/cards/pr-01/PR105';
import { event } from '@/engine/event/index';
import { _clearPendingEffectPickQueue } from '@/engine/effect/resolve-picks';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { mutate } from '@/engine/mutate/index';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { _resetRegistry, register } from '@/engine/read/def';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { createEmptyGameState } from '@/engine/state-factory';
import type { CardDef, GameState, SceneCharacter } from '@/engine/types';

const TOP_CARD = 'QA_HOST_ABSENT_TOP';
const BOTTOM_CARD = 'QA_HOST_ABSENT_BOTTOM';

const fixture = (id: string): CardDef => ({
  id,
  no: id,
  kind: 'character',
  names: [id],
  colors: ['blue'],
  level: 1,
  ap: 1000,
  lp: 1,
  traits: [],
  keywords: [],
  rarity: 'C',
  imageUrl: '',
  abilities: [],
  ruleRefs: [],
});

const CASES = [
  {
    card: PR099,
    qaId: 'card:PR099:66bdc617b3738eb67c09245f9af51faf6bffe85703797a9dcdd7d5ef898b0c08',
  },
  {
    card: B05035,
    qaId: 'card:B05035:66bdc617b3738eb67c09245f9af51faf6bffe85703797a9dcdd7d5ef898b0c08',
  },
  {
    card: PR105,
    qaId: 'card:PR105:66bdc617b3738eb67c09245f9af51faf6bffe85703797a9dcdd7d5ef898b0c08',
  },
] as const;

function emitEnter(state: GameState, character: SceneCharacter): void {
  event.emit(
    state,
    'enter',
    { uid: character.uid, player: 'self', enterOrder: 1, enterOrderThisTurn: 1 },
    { player: 'self', cardId: character.cardId, uid: character.uid },
  );
}

describe('official Q&A: set-card source leaves before resolution', () => {
  beforeEach(() => {
    event._resetRegistry();
    _resetTriggeredRegistered();
    _resetRegistry();
    _resetUidCounter();
    _clearPendingEffectPickQueue();
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = null;

    for (const card of [PR099, B05035, PR105, fixture(TOP_CARD), fixture(BOTTOM_CARD)]) {
      register(card);
    }
    registerTriggeredListener();
  });

  it.each(CASES)('$qaId', ({ card, qaId }) => {
    const state = createEmptyGameState();
    state.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    state.players.self.deck = [TOP_CARD, BOTTOM_CARD];

    const source = mutate.scene.enter(state, 'self', card.id, {});
    emitEnter(state, source);
    expect(state.pendingEffects).toEqual(expect.arrayContaining([
      expect.objectContaining({
        source: expect.objectContaining({ cardId: card.id, uid: source.uid, abilityId: 'a1' }),
      }),
    ]));

    mutate.scene.removeToRemove(state, source.uid, 'effect');
    runAllUntilEmpty(state);

    expect(['PR099', 'B05035', 'PR105']).toContain(card.id);
    expect(qaId.startsWith(`card:${card.id}:`)).toBe(true);
    expect(state.players.self.scene.some(character => character.uid === source.uid)).toBe(false);
    expect(state.players.self.remove).toContain(card.id);
    expect(state.players.self.deck).toEqual([TOP_CARD, BOTTOM_CARD]);
    expect(state.players.self.hand).not.toContain(TOP_CARD);
    expect(state.players.self.scene.flatMap(character => character.setCards)).toEqual([]);
  });
});
