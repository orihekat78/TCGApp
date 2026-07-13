import { beforeEach, describe, expect, it } from 'vitest';
import { produce } from '@/engine/produce';
import { createEmptyGameState } from '@/engine/state-factory';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { mutate } from '@/engine/mutate';
import { event } from '@/engine/event';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import type { CardDef } from '@/engine/types';

const HOST: CardDef = { id: 'HOST', no: 'HOST', kind: 'character', names: ['Host'], colors: ['青'], level: 1, ap: 1000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [] };
const SET_EVENT: CardDef = {
  id: 'B06012', no: '0637/B06012', kind: 'event', names: ['石川五右衛門人形'], colors: ['青'], level: 7,
  traits: [], keywords: [], rarity: 'C', imageUrl: '', ruleRefs: [],
  abilities: [{
    id: 'a3', type: 'triggered', scope: 'on-set-self', trigger: { hook: 'phase:end:start' },
    effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } }, description: '', ruleRefs: [],
  }],
};

beforeEach(() => {
  resetDefRegistry(); event._resetRegistry(); _resetTriggeredRegistered();
  registerCardDef(HOST); registerCardDef(SET_EVENT);
});

describe('on-set-self phase:end:start (B06012)', () => {
  it('queues the face-up set event ability with the exact host as source', () => {
    registerTriggeredListener();
    const after = produce(createEmptyGameState(), (draft) => {
      const host = mutate.scene.enter(draft, 'self', 'HOST', {});
      mutate.char.setCard(draft, host.uid, 'B06012', true);
    event.emit(draft, 'phase:end:start', { player: 'self' }, { player: 'self' });
    });
    expect(after.pendingEffects).toHaveLength(1);
    expect(after.pendingEffects[0]?.source).toMatchObject({ cardId: 'B06012', uid: expect.any(String) });
  });
});
