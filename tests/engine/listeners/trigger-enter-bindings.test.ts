import { beforeEach, describe, expect, it } from 'vitest';
import { event } from '@/engine/event';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { _resetRegistry, register } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import { sceneChar } from '../../helpers/fixtures';
import type { CardDef } from '@/engine/types';

const ENTRANT: CardDef = { id: 'ENTER_BINDING_ENTRANT', no: 'ENTER_BINDING_ENTRANT', kind: 'character', names: ['Entrant'], colors: ['赤'], level: 3, ap: 1000, lp: 1, traits: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [] };
const HOST: CardDef = {
  ...ENTRANT,
  id: 'ENTER_BINDING_HOST', no: 'ENTER_BINDING_HOST', names: ['Host'],
  abilities: [{
    id: 'a1', type: 'triggered', scope: 'on-scene', trigger: { hook: 'enter' },
    condition: { kind: 'boundMatchesFilter', bindKey: '$triggerChar', filter: { cardId: ENTRANT.id } },
    effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 0 } }, description: '', ruleRefs: [],
  }],
};

beforeEach(() => {
  event._resetRegistry();
  _resetTriggeredRegistered();
  _resetRegistry();
  [HOST, ENTRANT].forEach(register);
  registerTriggeredListener();
});

describe('enter trigger bindings', () => {
  it('uses a live entrant candidate for the gate and persists a separate JSON-safe queue binding per enter event', () => {
    const state = createEmptyGameState();
    state.players.self.scene.push(sceneChar(HOST.id, 'host'), sceneChar(ENTRANT.id, 'one'), sceneChar(ENTRANT.id, 'two'));
    event.emit(state, 'enter', { uid: 'one', viaEffect: false, enterOrder: 1 }, { player: 'self', uid: 'one', cardId: ENTRANT.id });
    event.emit(state, 'enter', { uid: 'two', viaEffect: false, enterOrder: 2 }, { player: 'self', uid: 'two', cardId: ENTRANT.id });

    expect(state.pendingEffects.map(entry => entry.bindings?.$triggerChar?.[0])).toEqual([
      { kind: 'char', uid: 'one', cardId: ENTRANT.id, player: 'self' },
      { kind: 'char', uid: 'two', cardId: ENTRANT.id, player: 'self' },
    ]);
    expect(() => JSON.stringify(state.pendingEffects)).not.toThrow();

    event.emit(state, 'enter', { uid: 'gone', viaEffect: false, enterOrder: 3 }, { player: 'self', uid: 'gone', cardId: ENTRANT.id });
    expect(state.pendingEffects).toHaveLength(2);
  });
});
