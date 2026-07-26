import { describe, expect, it, beforeEach } from 'vitest';
import { run as runEffect } from '@/engine/effect/resolver';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import type { CardDef, EffectCtx, GameState } from '@/engine/types';

function character(id: string): CardDef {
  return {
    id, no: `9/${id}`, kind: 'character', names: [id], colors: ['blue'], level: 3,
    ap: 1000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
  } as unknown as CardDef;
}

beforeEach(() => {
  resetDefRegistry();
  registerCardDef(character('SELF_HAND'));
  registerCardDef(character('OWNER_HAND'));
});

describe('BUG-187: relative hand side', () => {
  it('source owner=opp still resolves player:self against the owner hand', () => {
    const s: GameState = createEmptyGameState();
    s.players.self.hand = ['SELF_HAND'];
    s.players.opp.hand = ['OWNER_HAND'];
    const ctx: EffectCtx = {
      source: { cardId: 'X', uid: 'u-x', abilityId: 'a1', player: 'opp', area: 'scene' },
      bindings: {},
    } as EffectCtx;
    runEffect(s, {
      kind: 'atom', verb: 'handReveal' as never,
      args: { player: 'self', max: 1, filter: { color: 'blue' }, bind: '$revealed' },
    }, ctx);
    const pending = (globalThis as {
      __pendingEffectPickQueue?: Array<{ candidates: Array<{ uid: string; cardId: string }> }>;
    }).__pendingEffectPickQueue?.at(-1);
    expect(pending?.candidates).toEqual([
      {
        kind: 'card', uid: 'card:opp:hand:OWNER_HAND#0', cardId: 'OWNER_HAND',
        player: 'opp', area: 'hand', index: 0,
      },
    ]);
  });
});
