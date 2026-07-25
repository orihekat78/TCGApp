import { beforeEach, describe, expect, it } from 'vitest';
import { produce } from 'immer';
import { event } from '@/engine/event/index';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { _resetRegistry as resetCardDefRegistry, register as registerCardDef } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import type { CardDef } from '@/engine/types';
import { makeChar } from '../../helpers/fixtures';

const reaction: CardDef = {
  id: 'DECLARED_REACTION', no: '0000/DECLARED_REACTION', kind: 'character',
  names: ['reaction'], colors: ['white'], level: 1, ap: 1000, lp: 1,
  traits: [], rarity: 'C', imageUrl: 'test.jpg', ruleRefs: [],
  abilities: [{
    id: 'a1', type: 'triggered', scope: 'on-scene',
    trigger: { hook: 'effect:declared' },
    effect: { kind: 'atom', verb: 'noop', args: {} }, description: 'reaction',
  }],
};

describe('declared batch sequence persistence', () => {
  beforeEach(() => {
    event._resetRegistry();
    _resetTriggeredRegistered();
    resetCardDefRegistry();
    registerCardDef(reaction);
    registerTriggeredListener();
  });

  it('resumes a legacy save above every persisted declared batch without collision', () => {
    const state = createEmptyGameState();
    state.players.self.scene = [makeChar({ uid: 'reaction', cardId: reaction.id })];
    delete state.declaredBatchSeq;
    state.pendingEffects.push({
      id: 'legacy-declared',
      source: { player: 'self', cardId: 'LEGACY' },
      triggeredBy: { hook: 'effect:declared' },
      triggeredAt: { turn: 2, phase: 'main', nano: 1 },
      effect: { kind: 'atom', verb: 'noop', args: {} },
      state: 'pending',
      declaredBatch: 41,
    });

    const after = produce(state, (draft) => {
      event.emit(draft, 'effect:declared', { kind: 'event-use', cardId: 'EV1' }, { player: 'self', cardId: 'EV1' });
    });

    const resumed = after.pendingEffects.find((entry) => entry.id !== 'legacy-declared');
    expect(resumed?.declaredBatch).toBe(42);
    expect(after.declaredBatchSeq).toBe(42);
  });
});
