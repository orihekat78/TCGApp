import { describe, expect, it } from 'vitest';
import { PR307 } from '@/cards/pr-01/PR307';
import { PR313 } from '@/cards/pr-01/PR313';
import type { CardDef } from '@/engine/types';
import { runCardScenario } from '../helpers/card-probe-harness';

const character = (id: string, props: Partial<CardDef> = {}): CardDef => ({
  id,
  no: id,
  kind: 'character',
  names: [id],
  colors: ['青'],
  level: 7,
  ap: 1000,
  lp: 1,
  traits: [],
  keywords: [],
  rarity: 'C',
  imageUrl: '',
  abilities: [],
  ruleRefs: [],
  ...props,
});

const pr307ConditionParts = (PR307.abilities.find((ability) => ability.id === 'a2')?.condition as {
  kind: 'and';
  cs: Array<{ kind: string; color?: string | string[] }>;
}).cs;
const pr307CaseColors = pr307ConditionParts.find((condition) => condition.kind === 'caseColor')?.color as string[];
const pr307PartnerColor = pr307ConditionParts.find((condition) => condition.kind === 'partnerColor')?.color as string;

const handRemovedObserver = character('PR307_HAND_REMOVED_OBSERVER', {
  level: 1,
  abilities: [{
    id: 'a1',
    type: 'triggered',
    scope: 'on-scene',
    trigger: {
      hook: 'hand:removed',
      matcherCondition: { kind: 'triggerByPlayerIs', side: 'self' },
    },
    effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
    description: 'PR307 effect-discard observer',
    ruleRefs: ['rules/15-abilities-effects.md'],
  }],
});

describe('PR307 / PR313 triggered optional effect', () => {
  it('PR307 emits hand:removed for the selected effect discard before continuing', () => {
    const discarded = character('PR307_DISCARDED');
    const kept = character('PR307_KEPT');
    const contactTarget = character('PR307_CONTACT_TARGET');

    const state = runCardScenario(PR307, [discarded, kept, contactTarget, handRemovedObserver], {
      name: 'PR307 effect discard emits hand:removed',
      setup: {
        caseColors: pr307CaseColors,
        partnerColors: [pr307PartnerColor],
        hand: [discarded.id, kept.id],
        selfScene: [
          { cardId: PR307.id, uid: 'pr307-source' },
          { cardId: handRemovedObserver.id, uid: 'discard-observer' },
        ],
        oppScene: [{ cardId: contactTarget.id, uid: 'contact-target' }],
        deckSize: 4,
      },
      drive: { kind: 'enter', cardId: PR307.id, uid: 'pr307-source' },
      script: [
        'optional:take',
        { pickCardId: discarded.id },
        { pickUid: 'pr307-source' },
        { pickUid: 'contact-target' },
      ],
      expect: [
        { kind: 'zone', side: 'self', zone: 'hand', cardId: discarded.id, present: false },
        { kind: 'zone', side: 'self', zone: 'hand', cardId: kept.id, present: true },
        { kind: 'handDelta', side: 'self', n: 1 },
      ],
    });

    expect(
      state.log.some((entry) => entry.action === 'effect:startContact'),
      'PR307 resumes after the hand:removed child trigger and starts contact',
    ).toBe(true);
  });

  it('PR307 accept with no hand card stops before sleep, draw, and contact', () => {
    const contactTarget = character('PR307_EMPTY_HAND_TARGET');
    const state = runCardScenario(PR307, [contactTarget], {
      name: 'PR307 empty-hand partial resolution',
      setup: {
        caseColors: pr307CaseColors,
        partnerColors: [pr307PartnerColor],
        hand: [],
        selfScene: [{ cardId: PR307.id, uid: 'pr307-source' }],
        oppScene: [{ cardId: contactTarget.id, uid: 'contact-target' }],
        deckSize: 3,
      },
      drive: { kind: 'enter', cardId: PR307.id, uid: 'pr307-source' },
      script: ['optional:take'],
      expect: [
        { kind: 'state', uid: 'pr307-source', state: 'active' },
        { kind: 'handDelta', side: 'self', n: 0 },
        { kind: 'deckDelta', side: 'self', n: 0 },
      ],
    });

    expect(
      state.log.some((entry) => entry.action === 'effect:startContact'),
      'PR307 empty-hand branch starts no contact',
    ).toBe(false);
  });

  it('PR307 discards but stops when no active level-7 target remains', () => {
    const discarded = character('PR307_NO_SLEEP_DISCARD');
    const sleeping = character('PR307_ALREADY_SLEEPING', { level: 8 });
    const stunned = character('PR307_ALREADY_STUNNED', { level: 8 });
    const contactTarget = character('PR307_NO_SLEEP_TARGET');
    const state = runCardScenario(PR307, [discarded, sleeping, stunned, contactTarget], {
      name: 'PR307 no active sleep target partial resolution',
      setup: {
        caseColors: pr307CaseColors,
        partnerColors: [pr307PartnerColor],
        hand: [discarded.id],
        selfScene: [
          { cardId: PR307.id, uid: 'pr307-source', state: 'sleep' },
          { cardId: sleeping.id, uid: 'already-sleeping', state: 'sleep' },
          { cardId: stunned.id, uid: 'already-stunned', state: 'stun' },
        ],
        oppScene: [{ cardId: contactTarget.id, uid: 'contact-target' }],
        deckSize: 3,
      },
      drive: { kind: 'enter', cardId: PR307.id, uid: 'pr307-source' },
      script: ['optional:take', { pickCardId: discarded.id }],
      expect: [
        { kind: 'zone', side: 'self', zone: 'hand', cardId: discarded.id, present: false },
        { kind: 'deckDelta', side: 'self', n: 0 },
      ],
    });

    expect(
      state.log.some((entry) => entry.action === 'effect:startContact'),
      'PR307 no-target branch starts no contact',
    ).toBe(false);
  });

  it('PR307 exact sleep pick excludes sleeping and stunned characters and cannot be skipped', () => {
    const discarded = character('PR307_EXACT_DISCARD');
    const sleeping = character('PR307_SLEEP_DECOY', { level: 8 });
    const stunned = character('PR307_STUN_DECOY', { level: 8 });
    const contactTarget = character('PR307_EXACT_CONTACT');
    const scenario = {
      name: 'PR307 exact active sleep target',
      setup: {
        caseColors: pr307CaseColors,
        partnerColors: [pr307PartnerColor],
        hand: [discarded.id],
        selfScene: [
          { cardId: PR307.id, uid: 'pr307-source' },
          { cardId: sleeping.id, uid: 'already-sleeping', state: 'sleep' as const },
          { cardId: stunned.id, uid: 'already-stunned', state: 'stun' as const },
        ],
        oppScene: [{ cardId: contactTarget.id, uid: 'contact-target' }],
        deckSize: 3,
      },
      drive: { kind: 'enter' as const, cardId: PR307.id, uid: 'pr307-source' },
    };

    runCardScenario(PR307, [discarded, sleeping, stunned, contactTarget], {
      ...scenario,
      script: [
        'optional:take',
        { pickCardId: discarded.id },
        { pickUid: 'pr307-source' },
        { pickUid: 'contact-target' },
      ],
      expect: [
        { kind: 'candidatesExclude', pickIndex: 1, uid: 'already-sleeping' },
        { kind: 'candidatesExclude', pickIndex: 1, uid: 'already-stunned' },
      ],
    });

    expect(
      () => runCardScenario(PR307, [discarded, sleeping, stunned, contactTarget], {
        ...scenario,
        script: ['optional:take', { pickCardId: discarded.id }, 'pick:skip'],
        expect: [],
      }),
      'PR307 accepted sleep choice is exactly one active level-7-or-higher character',
    ).toThrow();
  });

  it('PR313 preserves the complete PR307 ability contract', () => {
    expect(PR313.abilities, 'PR313 abilities equal PR307 abilities').toEqual(PR307.abilities);
    expect(
      PR313.ruleRefs.includes('rules/21-declared-ability-cost.md'),
      'PR313 triggered effect is not a declared cost',
    ).toBe(false);
  });
});
