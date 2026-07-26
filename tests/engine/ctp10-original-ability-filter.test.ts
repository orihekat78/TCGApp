// CT-P10 B10074/B10102 + 2026-07-26 B04018 official Q&A:
// "original ability" is printed-card metadata.  It remains present when its
// text is disabled, and an externally granted ability does not create one.
import { beforeEach, describe, expect, it } from 'vitest';
import { evalCond } from '@/engine/cond/eval';
import { targetFilterToPredicate } from '@/engine/effect/atom-handlers/_shared';
import { createEmptyGameState } from '@/engine/state-factory';
import { matchOneFilter } from '@/engine/target/candidates';
import { _resetRegistry as resetDefRegistry, register as registerCardDef } from '@/engine/read/def';
import { makeCtx, sceneChar } from '../helpers/fixtures';
import type { Candidate, CardDef, GameState, TargetFilter } from '@/engine/types';

function char(id: string, abilities: CardDef['abilities']): CardDef {
  return {
    id, no: `CT-P10/${id}`, kind: 'character', names: [id], colors: ['緑'],
    level: 4, ap: 3000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities, ruleRefs: [],
  };
}

const PRINTED = char('PRINTED', [{ id: 'a1', type: 'continuous', scope: 'on-scene', description: 'printed ability' }]);
const VANILLA = char('VANILLA', []);

function cand(uid: string, cardId: string): Candidate {
  return { kind: 'char', uid, cardId, player: 'self' };
}

const originalAbility = (hasOriginalAbility: boolean): TargetFilter =>
  ({ hasOriginalAbility });

let state: GameState;
beforeEach(() => {
  resetDefRegistry();
  registerCardDef(PRINTED);
  registerCardDef(VANILLA);
  state = createEmptyGameState();
});

function matches(cardId: string, filter: TargetFilter, disabledOriginal = false): boolean {
  const char = sceneChar(cardId, `${cardId}#1`, {
    keywordOverrides: { granted: disabledOriginal ? ['外部能力'] : [], disabledOriginal },
  });
  state.players.self.scene = [char];
  return matchOneFilter(state, cardId, filter, char, cand(char.uid, cardId));
}

describe('CT-P10 original ability filter', () => {
  it('uses printed abilities, not whether their text is currently enabled or granted', () => {
    expect(matches('PRINTED', originalAbility(true))).toBe(true);
    expect(matches('PRINTED', originalAbility(false))).toBe(false);

    // B04018 disables text only. The target still has its printed ability.
    expect(matches('PRINTED', originalAbility(true), true)).toBe(true);
    expect(matches('PRINTED', originalAbility(false), true)).toBe(false);

    // External grants do not give a vanilla card an original ability.
    expect(matches('VANILLA', originalAbility(false), true)).toBe(true);
    expect(matches('VANILLA', originalAbility(true), true)).toBe(false);
  });

  it('keeps deck predicates and bound conditions aligned with target picks', () => {
    const noOriginal = originalAbility(false);
    const hasOriginal = originalAbility(true);
    expect(targetFilterToPredicate(noOriginal)('VANILLA')).toBe(true);
    expect(targetFilterToPredicate(noOriginal)('PRINTED')).toBe(false);
    expect(targetFilterToPredicate(hasOriginal)('PRINTED')).toBe(true);

    const ctx = makeCtx({ bindings: { chosen: [{ cardId: 'VANILLA', player: 'self' }] } });
    expect(evalCond(state, { kind: 'boundMatchesFilter', bindKey: 'chosen', filter: noOriginal }, ctx)).toBe(true);
    expect(evalCond(state, { kind: 'boundMatchesFilter', bindKey: 'chosen', filter: hasOriginal }, ctx)).toBe(false);
  });
});
