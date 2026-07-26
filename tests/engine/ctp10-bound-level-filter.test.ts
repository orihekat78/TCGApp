// CT-P10 B10060: a later target uses the entered character's effective level.
import { beforeAll, describe, expect, it } from 'vitest';
import { registerAll } from '@/cards';
import { targetFilterToPredicateWithCtx } from '@/engine/effect/atom-handlers/_shared';
import { evalCond } from '@/engine/cond/eval';
import { candidates } from '@/engine/target/candidates';
import { createEmptyGameState } from '@/engine/state-factory';
import { sceneChar } from '../helpers/fixtures';

describe('CT-P10 bound effective-level filter', () => {
  beforeAll(() => registerAll());

  it('uses the bound character effective level and fails closed without it', () => {
    const state = createEmptyGameState();
    const entered = sceneChar('D11013', 'entered', { turnEffects: { lvlMod_turn: 2 } });
    state.players.self.scene = [entered]; // printed Lv7 → effective Lv9
    state.players.opp.scene = [
      sceneChar('D11013', 'equal'),
      sceneChar('B10079', 'above'), // exceeds the entered effective level
    ];
    const ref = { kind: 'pick' as const, query: { area: 'scene' as const, side: 'either' as const, filter: { levelMaxBound: { bindKey: '$entered' } } } };
    const ctx = { source: { player: 'self' as const, cardId: 'B10060', uid: 'source', area: 'case' as const }, bindings: { $entered: [{ uid: 'entered' }] } };
    expect(candidates(state, ref, ctx).map(c => c.uid).sort()).toEqual(['entered', 'equal']);
    expect(candidates(state, ref, { ...ctx, bindings: {} }).length).toBe(0);
  });

  it('uses the printed level when charRemoveSetCard binds a cardId without a uid', () => {
    const state = createEmptyGameState();
    state.players.self.scene = [sceneChar('D11013', 'level7')];
    state.players.opp.scene = [sceneChar('B10079', 'level8')];
    const ref = { kind: 'pick' as const, query: { area: 'scene' as const, side: 'either' as const, filter: { levelMaxBound: { bindKey: '$removedSet' } } } };
    const ctx = {
      source: { player: 'self' as const, cardId: 'B10026', uid: 'source', area: 'scene' as const },
      bindings: { $removedSet: [{ cardId: 'D11013' }] },
    };

    expect(candidates(state, ref, ctx).map(c => c.uid)).toEqual(['level7']);
  });

  it('fails closed for unresolved dynamic filters outside candidate enumeration', () => {
    const state = createEmptyGameState();
    const ctx = {
      source: { player: 'self' as const, cardId: 'B10026', uid: 'source', area: 'scene' as const },
      bindings: { chosen: [{ cardId: 'D11013' }] },
    };

    expect(targetFilterToPredicateWithCtx(state, { levelMaxBound: { bindKey: 'chosen' } }, ctx, 'self')('D11013')).toBe(false);
    expect(targetFilterToPredicateWithCtx(state, { apMaxSource: true }, ctx, 'self')('D11013')).toBe(false);
    expect(evalCond(state, { kind: 'boundMatchesFilter', bindKey: 'chosen', filter: { levelMaxBound: { bindKey: 'chosen' } } }, ctx)).toBe(false);
    expect(evalCond(state, { kind: 'boundMatchesFilter', bindKey: 'chosen', filter: { apMaxSource: true } }, ctx)).toBe(false);
  });
});
