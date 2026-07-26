import { describe, expect, it } from 'vitest';
import { produce } from '@/engine/produce';
import { runAtom } from '@/engine/effect/atom-handlers';
import { validate } from '@/engine/effect/validate';
import { mutate } from '@/engine/mutate';
import { char } from '@/engine/read/char';
import { _resetRegistry, register } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import type { AbilityDef, CardDef, Effect, EffectCtx } from '@/engine/types';
import { sceneChar } from '../../helpers/fixtures';

const HOST: CardDef = {
  id: 'GRANTED_CONTINUOUS_HOST', no: 'GRANTED_CONTINUOUS_HOST', kind: 'character', names: ['Host'], colors: ['黒'],
  level: 1, ap: 1000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
};
const ban: AbilityDef = {
  id: 'turn-contact-cutin-ban', type: 'continuous', scope: 'on-scene',
  continuousModifier: { selfCutinBanInContact: true }, description: 'granted ban', ruleRefs: [],
};
const ctx: EffectCtx = { source: { player: 'self', cardId: 'SRC', uid: 'src', abilityId: 'a1', area: 'scene' }, bindings: {} };

function state() {
  const value = createEmptyGameState();
  value.players.self.scene = [sceneChar(HOST.id, 'host')];
  return value;
}

describe('granted continuous self flags', () => {
  it('keeps a continuous grant typed, condition-gated, and effective despite original disable', () => {
    _resetRegistry();
    register(HOST);
    const value = produce(state(), (draft) => {
      runAtom(draft, 'charGrantAbility', { uid: 'host', scope: 'turn', ability: ban }, ctx);
      mutate.char.disableOriginalAbilities(draft, 'host', 'permanent');
    });
    const granted = value.players.self.scene[0]!.turnEffects.grantedAbilities as AbilityDef[];
    expect(granted[0]).toMatchObject({ type: 'continuous', scope: 'on-scene', continuousModifier: { selfCutinBanInContact: true } });
    expect(char.selfContinuousFlag(value, 'host', 'selfCutinBanInContact')).toBe(true);

    const gated = produce(state(), (draft) => runAtom(draft, 'charGrantAbility', {
      uid: 'host', scope: 'turn', ability: { ...ban, condition: { kind: 'false' } },
    }, ctx));
    expect(char.selfContinuousFlag(gated, 'host', 'selfCutinBanInContact')).toBe(false);

    const inactiveScope = produce(state(), (draft) => runAtom(draft, 'charGrantAbility', {
      uid: 'host', scope: 'turn', ability: { ...ban, scope: 'on-hand' },
    }, ctx));
    expect(char.selfContinuousFlag(inactiveScope, 'host', 'selfCutinBanInContact')).toBe(false);

    const disallowedFlag = produce(state(), (draft) => runAtom(draft, 'charGrantAbility', {
      uid: 'host', scope: 'turn', ability: { ...ban, continuousModifier: { selfActionBan: true } },
    }, ctx));
    expect(char.selfContinuousFlag(disallowedFlag, 'host', 'selfActionBan')).toBe(false);
  });

  it('cleans a turn grant and loses it when its bearer leaves', () => {
    _resetRegistry();
    register(HOST);
    const granted = produce(state(), (draft) => runAtom(draft, 'charGrantAbility', { uid: 'host', scope: 'turn', ability: ban }, ctx));
    const cleaned = produce(granted, (draft) => mutate.char.clearTurnEffects(draft, 'host', 'turn'));
    expect(char.selfContinuousFlag(cleaned, 'host', 'selfCutinBanInContact')).toBe(false);

    const left = produce(granted, (draft) => { draft.players.self.scene = []; });
    expect(char.selfContinuousFlag(left, 'host', 'selfCutinBanInContact')).toBe(false);
  });

  it('accepts only a complete continuous descriptor', () => {
    const valid: Effect = { kind: 'atom', verb: 'charGrantAbility', args: { uid: 'host', ability: ban } } as Effect;
    const missingModifier: Effect = { kind: 'atom', verb: 'charGrantAbility', args: { uid: 'host', ability: { type: 'continuous' } } } as Effect;
    const mixedTrigger: Effect = { kind: 'atom', verb: 'charGrantAbility', args: { uid: 'host', ability: { ...ban, trigger: { hook: 'enter' } } } } as Effect;
    const unsupported: Effect = { kind: 'atom', verb: 'charGrantAbility', args: { uid: 'host', ability: { type: 'icon-disguise' } } } as Effect;
    const actionBan: Effect = { kind: 'atom', verb: 'charGrantAbility', args: { uid: 'host', ability: { ...ban, continuousModifier: { selfActionBan: true } } } } as Effect;
    const extraModifier: Effect = { kind: 'atom', verb: 'charGrantAbility', args: { uid: 'host', ability: { ...ban, continuousModifier: { selfCutinBanInContact: true, selfActionBan: true } } } } as Effect;
    const invalidScope: Effect = { kind: 'atom', verb: 'charGrantAbility', args: { uid: 'host', ability: { ...ban, scope: 'always' } } } as Effect;
    const invalidCondition: Effect = { kind: 'atom', verb: 'charGrantAbility', args: { uid: 'host', ability: { ...ban, condition: { kind: 'not-a-condition' } } } } as Effect;
    const incompleteLeafCondition: Effect = { kind: 'atom', verb: 'charGrantAbility', args: { uid: 'host', ability: { ...ban, condition: { kind: 'turn' } } } } as Effect;
    const leafCondition: Effect = { kind: 'atom', verb: 'charGrantAbility', args: { uid: 'host', ability: { ...ban, condition: { kind: 'turn', player: 'self' } } } } as Effect;
    const validBooleanCondition: Effect = { kind: 'atom', verb: 'charGrantAbility', args: { uid: 'host', ability: { ...ban, condition: { kind: 'and', cs: [{ kind: 'true' }, { kind: 'not', c: { kind: 'false' } }] } } } } as Effect;
    const nonJson: Effect = { kind: 'atom', verb: 'charGrantAbility', args: { uid: 'host', ability: { ...ban, description: 1n } } } as Effect;
    expect(validate(valid).ok).toBe(true);
    expect(validate(missingModifier).ok).toBe(false);
    expect(validate(mixedTrigger).ok).toBe(false);
    expect(validate(unsupported).ok).toBe(false);
    expect(validate(actionBan).ok).toBe(false);
    expect(validate(extraModifier).ok).toBe(false);
    expect(validate(invalidScope).ok).toBe(false);
    expect(validate(invalidCondition).ok).toBe(false);
    expect(validate(incompleteLeafCondition).ok).toBe(false);
    expect(validate(leafCondition).ok).toBe(false);
    expect(validate(validBooleanCondition).ok).toBe(true);
    expect(validate(nonJson).ok).toBe(false);
  });
});
