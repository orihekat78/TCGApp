import { beforeEach, describe, expect, it } from 'vitest';
import { evalCond } from '@/engine/cond/eval';
import { evalDyn } from '@/engine/dyn/eval';
import { applyPickAndContinuation, drainAiEffectPicks } from '@/engine/effect/apply-pick';
import { _clearPendingEffectPickQueue, _pushPendingEffectPickSideForTest } from '@/engine/effect/pending-state';
import { targetFilterToPredicate } from '@/engine/effect/atom-handlers/_shared';
import { register as registerCardDef, _resetRegistry } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import { candidates } from '@/engine/target/candidates';
import { resolve } from '@/engine/target/resolve';
import { makeChar, makeCtx } from '../../helpers/fixtures';
import type { CardDef, TargetQuery } from '@/engine/types';

const KID = 'KID';
const KID_NAME = 'KID_NAME';
const ALIAS = '怪盗キッド';

function defOf(id: string, names: string[], aliases?: CardDef['nameAliasesByArea']): CardDef {
  return { id, no: `T/${id}`, kind: 'character', names, colors: [], level: 1, ap: 1, lp: 1, traits: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [], ...(aliases ? { nameAliasesByArea: aliases } : {}) };
}

describe('area-limited card-name aliases', () => {
  beforeEach(() => {
    _resetRegistry();
    _clearPendingEffectPickQueue();
    registerCardDef(defOf(KID, ['黒羽快斗'], { deck: [ALIAS], remove: [ALIAS] }));
    registerCardDef(defOf(KID_NAME, [ALIAS]));
  });

  it('matches the alias only in deck and remove, never in hand/scene/evidence/file', () => {
    const state = createEmptyGameState();
    state.players.self.deck = [KID];
    state.players.self.remove = [KID];
    state.players.self.hand = [KID];
    state.players.self.evidence = [{ cardId: KID, faceUp: true }];
    state.players.self.file = [{ type: 'card-back', cardId: KID, faceUp: true }];
    state.players.self.scene = [makeChar({ uid: 'kaito', cardId: KID })];
    const ctx = makeCtx({ source: { player: 'self', area: 'scene', uid: 'kaito' } });
    const query = (area: TargetQuery['area']) => candidates(state, { kind: 'all', query: { area, side: 'self', filter: { cardName: ALIAS } } }, ctx);

    expect(query('deck')).toHaveLength(1);
    expect(query('remove')).toHaveLength(1);
    expect(query('hand')).toEqual([]);
    expect(query('scene')).toEqual([]);
    expect(query('evidence')).toEqual([]);
    expect(query('file')).toEqual([]);
    expect(targetFilterToPredicate({ cardName: ALIAS })(KID)).toBe(true);
  });

  it('uses the same alias in remove conditions, remove dyn, bound filters, and distinct-name validation', () => {
    const state = createEmptyGameState();
    state.players.self.remove = [KID, KID_NAME];
    const ctx = makeCtx({ source: { player: 'self', area: 'scene', uid: 'source' }, bindings: {
      removed: [{ kind: 'card', cardId: KID, area: 'remove', player: 'self' }],
    } });

    expect(evalCond(state, { kind: 'removeNameAtLeast', player: 'self', cardName: ALIAS, n: 2 }, ctx)).toBe(true);
    expect(evalCond(state, { kind: 'boundMatchesFilter', bindKey: 'removed', filter: { cardName: ALIAS } }, ctx)).toBe(true);
    expect(evalDyn(state, '$self.removeNameCount.怪盗キッド', ctx)).toBe(2);
    expect(() => resolve(state, { kind: 'pick', query: { area: 'remove', side: 'self', distinctNames: true }, n: { min: 2, max: 2 }, chooser: 'owner' }, ctx, [
      { kind: 'card', cardId: KID, area: 'remove', player: 'self', index: 0 },
      { kind: 'card', cardId: KID_NAME, area: 'remove', player: 'self', index: 1 },
    ])).toThrow(/distinctNames/);
  });

  it('blocks duplicate alias selection for human picks and AI picks in remove', () => {
    const pending = {
      player: 'self' as const,
      candidates: [
        { uid: `${KID}#0`, cardId: KID, player: 'self' as const, kind: 'card' as const, area: 'remove' },
        { uid: `${KID_NAME}#1`, cardId: KID_NAME, player: 'self' as const, kind: 'card' as const, area: 'remove' },
      ],
      atomVerb: 'handAddFromRemove', atomArgs: { player: 'self', max: 2 }, nMin: 1, nMax: 2,
      source: { cardId: KID, abilityId: 'a1' }, distinctNames: true,
    };
    const human = createEmptyGameState();
    human.players.self.remove = [KID, KID_NAME];
    expect(() => applyPickAndContinuation(human, pending, `${KID}#0`, [`${KID}#0`, `${KID_NAME}#1`])).toThrow(/distinctNames/);

    const ai = createEmptyGameState();
    ai.players.self.remove = [KID, KID_NAME];
    _pushPendingEffectPickSideForTest(pending);
    drainAiEffectPicks(ai);
    expect(ai.players.self.hand).toEqual([KID]);
    expect(ai.players.self.remove).toEqual([KID_NAME]);
  });
});
