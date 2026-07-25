import { beforeEach, describe, expect, it } from 'vitest';
import { registerAll } from '@/cards/index.js';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def.js';
import { createEmptyGameState } from '@/engine/state-factory.js';
import { mutate } from '@/engine/mutate/index.js';
import { canDeclaredAbility } from '@/engine/flow/main/declared-ability.js';
import { activateDeclaredAbility } from '@/engine/flow/main/ability-activate.js';
import { runAllUntilEmpty } from '@/engine/resolve/index.js';
import type { CardDef } from '@/engine/types';

const TARGET: CardDef = {
  id: 'ALT_TARGET', no: 'test/ALT_TARGET', kind: 'character', names: ['探偵能力者'], colors: ['緑'], level: 4, ap: 0, lp: 1, traits: ['探偵'], keywords: [], rarity: 'C', imageUrl: '', ruleRefs: [],
  abilities: [{ id: 'a1', type: 'declared', scope: 'on-scene', limit: { kind: 'turn', n: 1 }, cost: { kind: 'sleepSelf' }, effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } }, description: '', ruleRefs: [] }],
};
const DECOY: CardDef = { ...TARGET, id: 'ALT_DECOY', no: 'test/ALT_DECOY', traits: ['警察'] };
const BLOCKED: CardDef = { ...TARGET, id: 'ALT_BLOCKED', no: 'test/ALT_BLOCKED', abilities: [{ ...TARGET.abilities[0]!, condition: { kind: 'turn', player: 'opp' } }] };

beforeEach(() => { resetDefRegistry(); registerAll(); registerCardDef(TARGET); registerCardDef(DECOY); registerCardDef(BLOCKED); });

describe('B05033 alternative declared cost', () => {
  it('removes the selected provider instead of the full printed cost and still consumes turn-1', () => {
    const s = createEmptyGameState();
    s.turn = { number: 1, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.self.deck = ['X'];
    const target = mutate.scene.enter(s, 'self', 'ALT_TARGET', {});
    const provider = mutate.scene.enter(s, 'self', 'B05033', {});
    expect(canDeclaredAbility(s, target.uid, 'a1')).toBe(true);
    activateDeclaredAbility(s, target.uid, 'a1', { alternativeCostProviderUid: provider.uid }); runAllUntilEmpty(s);
    expect(s.players.self.scene.some((c) => c.uid === provider.uid)).toBe(false);
    expect(s.players.self.scene.find((c) => c.uid === target.uid)?.state).toBe('active');
    expect(s.players.self.hand).toEqual(['X']);
    expect(canDeclaredAbility(s, target.uid, 'a1')).toBe(false);
  });

  it('does not permit a non-探偵 target and never bypasses a declared condition', () => {
    const s = createEmptyGameState();
    s.turn = { number: 1, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    const target = mutate.scene.enter(s, 'self', 'ALT_DECOY', {});
    const provider = mutate.scene.enter(s, 'self', 'B05033', {});
    activateDeclaredAbility(s, target.uid, 'a1', { alternativeCostProviderUid: provider.uid });
    expect(s.players.self.scene.find((c) => c.uid === provider.uid)).toBeDefined();
    expect(s.players.self.scene.find((c) => c.uid === target.uid)?.state).toBe('sleep');
    const blocked = mutate.scene.enter(s, 'self', 'ALT_BLOCKED', {});
    expect(canDeclaredAbility(s, blocked.uid, 'a1')).toBe(false);
    expect(s.players.self.scene.find((c) => c.uid === provider.uid)).toBeDefined();
  });
});
