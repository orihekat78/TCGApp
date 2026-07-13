import { beforeEach, describe, expect, it } from 'vitest';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { registerAll } from '@/cards';
import { read } from '@/engine/read';
import { createEmptyGameState } from '@/engine/state-factory';
import { sceneChar } from '../../helpers/fixtures';
import type { CardDef, GameState } from '@/engine/types';
import { B08059 } from '@/cards/ct-p08/B08059';
import { B08059P } from '@/cards/ct-p08/B08059P';
import { lookupCardDef } from '@/engine/target/card-def-registry';

const latch: CardDef = {
  id: 'B08059-LATCH', no: 'test/B08059-LATCH', kind: 'character', names: ['latch'], colors: ['赤'],
  level: 6, ap: 5000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '', ruleRefs: [],
  abilities: [{
    id: 'a1', type: 'continuous', scope: 'on-scene', ruleRefs: [],
    condition: { kind: 'and', cs: [
      { kind: 'turn', player: 'self' },
      { kind: 'sceneHas', query: { area: 'scene', side: 'self', filter: { levelMin: 7 } }, nMin: 2 },
    ] },
    continuousModifier: { lvlDelta: 1 },
  }],
};
const level7: CardDef = { ...latch, id: 'B08059-L7', no: 'test/B08059-L7', names: ['level7'], level: 7, abilities: [] };

function turn(s: GameState, player: 'self' | 'opp'): void {
  s.turn = { number: 2, player, phase: 'main', isFirstPlayerFirstTurn: false };
}

beforeEach(() => {
  resetDefRegistry();
  registerAll();
  registerCardDef(latch);
  registerCardDef(level7);
});

describe('B08059: sceneHas level filter includes the prospective self lvlDelta', () => {
  it('self L6 + external L7 becomes L7, then remains enabled after a former external L7 leaves', () => {
    const s = createEmptyGameState();
    turn(s, 'self');
    s.players.self.scene = [sceneChar('B08059-LATCH', 'self'), sceneChar('B08059-L7', 'other'), sceneChar('B08059-L7', 'other-2')];
    expect(read.char.level(s, 'self')).toBe(7);
    s.players.self.scene = [sceneChar('B08059-LATCH', 'self'), sceneChar('B08059-L7', 'other-2')];
    expect(read.char.level(s, 'self')).toBe(7);
  });

  it('does not self-enable without a second L7, and expires on opponent turn', () => {
    const s = createEmptyGameState();
    turn(s, 'self');
    s.players.self.scene = [sceneChar('B08059-LATCH', 'self')];
    expect(read.char.level(s, 'self')).toBe(6);
    s.players.self.scene.push(sceneChar('B08059-L7', 'other'));
    expect(read.char.level(s, 'self')).toBe(7);
    turn(s, 'opp');
    expect(read.char.level(s, 'self')).toBe(6);
  });
});

describe('B08059/P production dispatch', () => {
  it('registers both printings and applies level/AP/突撃 for owner=opp', () => {
    const s = createEmptyGameState();
    turn(s, 'opp');
    const p = sceneChar('B08059P', 'p');
    p.turnEffects.lvlMod_turn = 1;
    s.players.opp.scene = [sceneChar('B08059', 'm'), p];
    expect(lookupCardDef('B08059')).toBe(B08059);
    expect(lookupCardDef('B08059P')).toBe(B08059P);
    expect(read.char.level(s, 'm')).toBe(7);
    expect(read.char.ap(s, 'm')).toBe(6000);
    expect(read.char.hasKeyword(s, 'm', '突撃')).toBe(true);
  });

  it('honors turn modifier and keeps base/P rule text structurally equal', () => {
    const s = createEmptyGameState();
    turn(s, 'self');
    const m = sceneChar('B08059', 'm');
    m.turnEffects.lvlMod_turn = 1;
    s.players.self.scene = [m];
    expect(read.char.level(s, 'm')).toBe(7);
    expect(B08059.abilities[0]).toMatchObject({
      id: B08059P.abilities[0]?.id,
      condition: B08059P.abilities[0]?.condition,
      continuousModifier: { lvlDelta: 1, apDelta: 1000 },
      description: B08059P.abilities[0]?.description,
    });
  });
});
