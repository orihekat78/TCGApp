import { beforeEach, describe, expect, it } from 'vitest';
import type { AbilityDef, CardDef, GameState } from '@/engine/types';
import { B10056 } from '@/cards/ct-p10/B10056';
import { register, _resetRegistry } from '@/engine/read/def';
import { char as readChar } from '@/engine/read/char';
import { createEmptyGameState } from '@/engine/state-factory';
import { sceneChar } from '../../helpers/fixtures';

function char(id: string, traits: string[]): CardDef {
  return {
    id, no: `CT-P10/${id}`, kind: 'character', names: [id], colors: ['赤'],
    level: 4, ap: 4000, lp: 1, traits, keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
  };
}

const BOTH = char('B10056_BOTH', ['女流棋士', '棋士']);
const WOMAN_ONLY = char('B10056_WOMAN_ONLY', ['女流棋士']);
const SHOGI_ONLY = char('B10056_SHOGI_ONLY', ['棋士']);

function ownTurn(): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 2, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  return state;
}

beforeEach(() => {
  _resetRegistry();
  [B10056, BOTH, WOMAN_ONLY, SHOGI_ONLY].forEach(register);
});

describe('B10056 勝又水菜', () => {
  const [a1, a2] = B10056.abilities as AbilityDef[];

  it('maps both printed clauses, preserving conjunction for the continuous aura and OR for Hirameki', () => {
    expect(a1).toMatchObject({
      type: 'continuous', scope: 'on-scene', condition: { kind: 'turn', player: 'self' },
      continuousModifier: { apDeltaAura: 1000, auraExcludeSelf: true, auraFilter: { kind: 'character', traitAll: ['女流棋士', '棋士'] } },
    });
    expect(a2).toMatchObject({
      type: 'triggered', scope: 'on-evidence', trigger: { hook: 'evidence:remove-by-action', optional: true },
      effect: { kind: 'atom', verb: 'handAddFromRemove', args: { player: 'self', max: 1, filter: { kind: 'character', trait: ['女流棋士', '棋士'] } } },
    });
  });

  it('gives AP only to a different character that has both required traits, and ends immediately off-turn', () => {
    const state = ownTurn();
    state.players.self.scene = [
      sceneChar('B10056', 'host'),
      sceneChar('B10056_BOTH', 'both'),
      sceneChar('B10056_WOMAN_ONLY', 'woman'),
      sceneChar('B10056_SHOGI_ONLY', 'shogi'),
    ];
    expect(readChar.ap(state, 'host')).toBe(4000);
    expect(readChar.ap(state, 'both')).toBe(5000);
    expect(readChar.ap(state, 'woman')).toBe(4000);
    expect(readChar.ap(state, 'shogi')).toBe(4000);
    state.turn.player = 'opp';
    expect(readChar.ap(state, 'both')).toBe(4000);
  });
});
