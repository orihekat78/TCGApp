import { beforeEach, describe, expect, it } from 'vitest';
import type { Candidate, CardDef, TargetFilter } from '@/engine/types';
import { register, _resetRegistry } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import { sceneChar } from '../helpers/fixtures';
import { matchOneFilter } from '@/engine/target/candidates';
import { targetFilterToPredicate } from '@/engine/effect/atom-handlers/_shared';

function char(id: string, traits: string[]): CardDef {
  return {
    id, no: `CT-P10/${id}`, kind: 'character', names: [id], colors: ['赤'],
    level: 4, ap: 4000, lp: 1, traits, keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
  };
}

const BOTH = char('BOTH', ['女流棋士', '棋士']);
const WOMAN_ONLY = char('WOMAN_ONLY', ['女流棋士']);
const SHOGI_ONLY = char('SHOGI_ONLY', ['棋士']);
const DECOY = char('DECOY', ['探偵', '警察']);

function candidate(id: string, uid: string): Candidate {
  return { kind: 'char', uid, cardId: id, player: 'self' };
}

beforeEach(() => {
  _resetRegistry();
  [BOTH, WOMAN_ONLY, SHOGI_ONLY, DECOY].forEach(register);
});

describe('CT-P10 traitAll target filter', () => {
  it('requires every listed effective trait, never an any-trait match', () => {
    const s = createEmptyGameState();
    s.players.self.scene = [
      sceneChar('BOTH', 'both'),
      sceneChar('WOMAN_ONLY', 'woman'),
      sceneChar('SHOGI_ONLY', 'shogi'),
      sceneChar('DECOY', 'decoy'),
    ];
    const filter: TargetFilter = { kind: 'character', traitAll: ['女流棋士', '棋士'] };
    for (const c of s.players.self.scene) {
      const expected = c.uid === 'both';
      expect(matchOneFilter(s, c.cardId, filter, c, candidate(c.cardId, c.uid)), c.uid).toBe(expected);
    }
  });

  it('keeps deck/reveal predicate and malformed empty selectors fail closed', () => {
    const both = targetFilterToPredicate({ traitAll: ['女流棋士', '棋士'] });
    expect(both('BOTH')).toBe(true);
    expect(both('WOMAN_ONLY')).toBe(false);
    expect(targetFilterToPredicate({ traitAll: [] })('BOTH')).toBe(false);
  });
});
