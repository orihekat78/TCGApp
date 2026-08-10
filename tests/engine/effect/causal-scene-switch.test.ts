import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { startCausalSession, validateCausalLog } from '@/engine/log/causal';
import { produce } from '@/engine/produce';
import { register, _resetRegistry } from '@/engine/read/def';
import { runOne } from '@/engine/resolve/stack';
import { createEmptyGameState } from '@/engine/state-factory';
import type { CardDef, CausalLogEntryV1, EffectStackEntry, GameState } from '@/engine/types';
import { makeChar } from '../../helpers/fixtures';

function characterDef(id: string, rarity: CardDef['rarity'] = 'R'): CardDef {
  return {
    id,
    no: id,
    kind: 'character',
    names: [id],
    colors: ['blue'],
    level: 1,
    ap: 1_000,
    lp: 1,
    traits: [],
    keywords: [],
    rarity,
    imageUrl: '',
    abilities: [],
    ruleRefs: [],
  };
}

function runCausalSwitch(
  sessionId: string,
  setup: (state: GameState) => void,
  removeUid: string,
  cardId = 'NEW',
): GameState {
  const state = createEmptyGameState();
  setup(state);
  startCausalSession(state, sessionId);
  return produce(state, (draft) => {
    runOne(draft, {
      id: `${sessionId}-entry`,
      source: {
        player: 'self',
        cardId: 'PRIVATE-SOURCE',
        uid: 'private-source-uid',
        abilityId: 'a1',
        area: 'hand',
      },
      triggeredBy: { hook: 'manual' },
      triggeredAt: { turn: 1, phase: 'main', nano: 1 },
      effect: {
        kind: 'atom',
        verb: 'sceneSwitch',
        args: { player: 'self', cardId, removeUid },
      },
      state: 'pending',
    } satisfies EffectStackEntry);
  });
}

describe('sceneSwitch causal projection', () => {
  beforeEach(() => {
    _resetRegistry();
    register(characterDef('OLD'));
    register(characterDef('NEW'));
    register(characterDef('MR-OLD', 'MR'));
    register(characterDef('MR-NEW', 'MR'));
    register(characterDef('VICTIM'));
  });

  afterEach(() => {
    _resetRegistry();
  });

  it('records the actual public removal and entering card in one ordered chain', () => {
    const result = runCausalSwitch('scene-switch-normal', (state) => {
      state.players.self.scene = [makeChar({ uid: 'old-uid', cardId: 'OLD' })];
    }, 'old-uid');

    const entries = validateCausalLog(result.log as CausalLogEntryV1[]);
    expect(entries.map((entry) => [
      entry.kind,
      entry.parentEventId,
      entry.correlationEventId,
      entry.outcome,
    ])).toEqual([
      ['declare', undefined, undefined, { type: 'state', state: 'active' }],
      ['zone-move', 'scene-switch-normal:1', undefined, { type: 'move', from: 'scene', to: 'remove', count: 1 }],
      ['enter', 'scene-switch-normal:2', undefined, { type: 'state', state: 'success' }],
      ['summary', 'scene-switch-normal:3', undefined, { type: 'state', state: 'success' }],
    ]);
    expect(entries[2].targets).toEqual([
      expect.objectContaining({ kind: 'card', cardNumber: 'NEW', side: 'self', zone: 'scene' }),
    ]);
    expect(JSON.stringify(result.log)).not.toContain('PRIVATE-SOURCE');
    expect(result.log).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ action: 'effect:sceneSwitch' }),
    ]));
  });

  it('reports the MR rule removal rather than a switch victim that stayed in play', () => {
    const result = runCausalSwitch('scene-switch-mr', (state) => {
      state.turn.player = 'self';
      state.players.self.scene = [
        makeChar({ uid: 'mr-old', cardId: 'MR-OLD' }),
        makeChar({ uid: 'victim', cardId: 'VICTIM' }),
      ];
    }, 'victim', 'MR-NEW');

    expect(result.players.self.scene.map((card) => card.uid)).toContain('victim');
    expect(result.players.self.remove).toContain('MR-OLD');
    expect(result.players.self.remove).not.toContain('VICTIM');
    expect(validateCausalLog(result.log as CausalLogEntryV1[]).map((entry) => entry.outcome)).toContainEqual({
      type: 'move',
      from: 'scene',
      to: 'remove',
      count: 1,
    });
  });
});
