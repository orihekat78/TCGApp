import { beforeEach, describe, expect, it } from 'vitest';
import { createEmptyGameState } from '@/engine/state-factory';
import { eligibleRemoveSetCards } from '@/engine/cost/remove-set-card-eligible';
import { canPay } from '@/engine/cost/evaluate';
import { canPayAtomically, canPayWithPreflight, pay } from '@/engine/cost/pay';
import { register, _resetRegistry } from '@/engine/read/def';
import type { CardDef, Cost, EffectCtx, SceneCharacter } from '@/engine/types';

const def = (id: string, over: Partial<CardDef> = {}): CardDef => ({ id, no: id, kind: 'event', names: [id], colors: [], level: 1, traits: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [], ...over });
const host = (cardId: string, uid: string, sets: SceneCharacter['setCards']): SceneCharacter => ({ cardId, uid, state: 'active', isNamed: false, enterOrder: 1, enterOrderThisTurn: 1, setCards: sets, stackedCards: 0, keywordOverrides: { granted: [], disabledOriginal: false }, apOverride: null, lpOverride: null, turnEffects: { contactImmune: false, removeOnTurnEnd: false }, declaredUseCount: {} });
const ctx: EffectCtx = { source: { player: 'self', uid: 'src', cardId: 'SRC', abilityId: 'a', area: 'scene' }, bindings: {} };

beforeEach(() => _resetRegistry());
describe('removeSetCard eligible set', () => {
  it('evaluates a face-up set card filter from that card printed data, not its host', () => {
    register(def('SRC'));
    register(def('HOST', { kind: 'character', level: 8, names: ['Host'] }));
    register(def('SET', { kind: 'event', level: 1, names: ['Set card'] }));
    const s = createEmptyGameState();
    s.players.self.scene = [host('SRC', 'src', []), host('HOST', 'h', [{ cardId: 'SET', faceUp: true, instanceId: 'set' }])];
    const cost: Cost = { kind: 'removeSetCard', n: 1, face: 'up', filter: { levelMax: 1 } };
    const paymentCtx: EffectCtx = { ...ctx, dyn: { costParams: { removeSetCard: { hostUids: ['h'], instanceIds: ['set'] } } } };
    expect(eligibleRemoveSetCards(s, cost, ctx).map(({ entry }) => entry.instanceId)).toEqual(['set']);
    expect(canPay(s, cost, paymentCtx)).toBe(true);
    expect(canPayAtomically(s, cost, paymentCtx)).toBe(true);
    expect(canPayWithPreflight(s, cost, paymentCtx)).toBe(true);
  });

  it('filters only face-up identity and pays an exact instance', () => {
    register(def('SRC')); register(def('HOST', { kind: 'character', names: ['服部平次'] })); register(def('UP', { names: ['正式名'] })); register(def('DOWN', { names: ['秘密'] }));
    const s = createEmptyGameState();
    s.players.self.scene = [host('SRC', 'src', []), host('HOST', 'h', [{ cardId: 'UP', faceUp: true, instanceId: 'up' }, { cardId: 'DOWN', faceUp: false, instanceId: 'down' }])];
    const cost: Cost = { kind: 'removeSetCard', n: 1, face: 'up', filter: { cardName: '正式名' }, hostQuery: { area: 'scene', side: 'self', filter: { cardName: '服部平次' } } };
    expect(eligibleRemoveSetCards(s, cost, ctx).map(x => x.entry.instanceId)).toEqual(['up']);
    expect(canPay(s, cost, ctx)).toBe(true);
    const paymentCtx: EffectCtx = { ...ctx, dyn: { costParams: { removeSetCard: { hostUids: ['h'], instanceIds: ['up'] } } } };
    pay(s, cost, paymentCtx);
    expect(s.players.self.remove).toEqual(['UP']);
    expect(s.players.self.scene[1]!.setCards.map(x => x.instanceId)).toEqual(['down']);
  });
  it('rejects forged host/duplicate witness and keeps payment atomic', () => {
    register(def('SRC')); register(def('HOST', { kind: 'character' })); register(def('SET'));
    const s = createEmptyGameState(); s.players.self.scene = [host('SRC', 'src', []), host('HOST', 'h', [{ cardId: 'SET', faceUp: false, instanceId: 'one' }])];
    const cost: Cost = { kind: 'removeSetCard', n: 1, face: 'down' };
    expect(() => pay(s, cost, { ...ctx, dyn: { costParams: { removeSetCard: { hostUids: ['opp'], instanceIds: ['one'] } } } })).toThrow();
    expect(s.players.self.scene[1]!.setCards).toHaveLength(1);
  });
});
