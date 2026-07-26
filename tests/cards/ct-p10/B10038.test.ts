import { beforeEach, describe, expect, it } from 'vitest';
import { B10038, B10038P } from '@/cards/ct-p10/B10038';
import { validateCards } from '@/engine/effect/validate';
import { evalCond } from '@/engine/cond/eval';
import { _resetRegistry as resetDefRegistry, register } from '@/engine/read/def';
import { candidates } from '@/engine/target/candidates';
import { createEmptyGameState } from '@/engine/state-factory';
import { makeCtx } from '../../helpers/fixtures';
import type { CardDef } from '@/engine/types';

const kidQuery = { kind: 'all' as const, query: { area: 'deck' as const, side: 'self' as const, filter: { cardName: '怪盗キッド' } } };
const sourceChar: CardDef = { id: 'SOURCE_CHAR', no: 'T/SOURCE_CHAR', kind: 'character', names: ['SOURCE_CHAR'], colors: [], level: 1, ap: 1, lp: 1, traits: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [] };
const sourceEvent: CardDef = { ...sourceChar, id: 'SOURCE_EVENT', no: 'T/SOURCE_EVENT', kind: 'event', names: ['SOURCE_EVENT'], level: 1 };

beforeEach(() => { resetDefRegistry(); [B10038, B10038P, sourceChar, sourceEvent].forEach(register); });

describe('B10038 黒羽快斗', () => {
  it('validates the character-enter rider and Hirameki sleep path', () => {
    expect(validateCards([B10038, B10038P]).ok).toBe(true);
    const rider = (B10038.abilities[0]!.effect as { args: { ability: { condition: unknown; trigger: { hook: string }; limit: unknown; effect: { kind: string } } } }).args.ability;
    expect(rider.trigger.hook).toBe('leave:to-remove');
    expect(rider.limit).toEqual({ kind: 'turn', n: 1 });
    expect(rider.effect.kind).toBe('atom');
    const hirameki = B10038.abilities[1]!.effect as { kind: string; options: Array<{ args: { state: string; target: { n: { min: number; max: number } } } }> };
    expect(hirameki.kind).toBe('choice');
    expect(hirameki.options[0]!.args.state).toBe('sleep');
    expect(hirameki.options[0]!.args.target.n).toEqual({ min: 0, max: 1 });
  });

  it('grants the rider only for entry caused by a self character ability', () => {
    const state = createEmptyGameState();
    const condition = B10038.abilities[0]!.condition!;
    const ctx = makeCtx({ source: { player: 'self', area: 'scene', uid: 'kaito', cardId: 'B10038' }, triggerPayload: { viaEffect: true, sourcePlayer: 'self', sourceCardId: 'SOURCE_CHAR' } });
    expect(evalCond(state, condition, ctx)).toBe(true);
    expect(evalCond(state, condition, makeCtx({ ...ctx, triggerPayload: { viaEffect: true, sourcePlayer: 'self', sourceCardId: 'SOURCE_EVENT' } }))).toBe(false);
    expect(evalCond(state, condition, makeCtx({ ...ctx, triggerPayload: { viaEffect: true, sourcePlayer: 'opp', sourceCardId: 'SOURCE_CHAR' } }))).toBe(false);
  });

  it('treats this card as 怪盗キッド in deck and remove, but not hand or scene', () => {
    const state = createEmptyGameState();
    state.players.self.deck = ['B10038'];
    state.players.self.remove = ['B10038'];
    state.players.self.hand = ['B10038'];
    const ctx = makeCtx({ source: { player: 'self', area: 'scene', uid: 'source' } });
    expect(candidates(state, kidQuery, ctx)).toHaveLength(1);
    expect(candidates(state, { ...kidQuery, query: { ...kidQuery.query, area: 'remove' } }, ctx)).toHaveLength(1);
    expect(candidates(state, { ...kidQuery, query: { ...kidQuery.query, area: 'hand' } }, ctx)).toHaveLength(0);
  });

  it('keeps P behavior identical except printing metadata', () => {
    expect({ ...B10038P, id: B10038.id, no: B10038.no, rarity: B10038.rarity, imageUrl: B10038.imageUrl }).toEqual(B10038);
  });
});
