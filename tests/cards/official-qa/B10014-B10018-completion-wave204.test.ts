// qa: card:B10014:22fc4e7b7317de3c7079b1bf41218c514e90894853bcbfb2c68ab69bc4f38a81
// qa: card:B10014:e055c372f548caad8b915bf468def69671daa0657c8c3268ba51b3cb04872a17
// qa: card:B10015:a0c5910dad875dad16ab2730818da85f2714b3bd9f92a90198d240af7ddfef78
// qa: card:B10018:ac6deca54abb40e5febfb9c134935a67110fe6ce124bd3a654a18364afaf1ff1

import { describe, expect, it } from 'vitest';
import { B10014 } from '@/cards/ct-p10/B10014';
import { B10015 } from '@/cards/ct-p10/B10015';
import { B10018 } from '@/cards/ct-p10/B10018';

describe('official QA Wave204: CT-P10 blue continuous and event contracts', () => {
  it('gives B10014 its office trait as a continuous field-only ability', () => {
    expect(B10014.abilities.find((ability) => ability.id === 'a1')).toMatchObject({
      type: 'continuous',
      scope: 'on-scene',
      continuousModifier: { grantTraits: ['毛利探偵事務所'] },
    });
  });

  it('does not model B10014 office-trait text as an optional or triggered choice', () => {
    const ability = B10014.abilities.find((candidate) => candidate.id === 'a1')!;

    expect(ability).toMatchObject({ type: 'continuous', scope: 'on-scene' });
    expect(ability).not.toHaveProperty('trigger');
  });

  it('grants B10015 rapid continuously only at four distinct office names', () => {
    const ability = B10015.abilities.find((candidate) => candidate.id === 'a2')!;

    expect(ability).toMatchObject({
      type: 'continuous',
      scope: 'on-scene',
      condition: {
        kind: 'sceneHas',
        query: { area: 'scene', side: 'self', distinctNames: true, filter: { trait: '毛利探偵事務所' } },
        nMin: 4,
      },
    });
    expect(ability.continuousModifier?.grantKeywords?.()).toEqual(['迅速']);
  });

  it('uses B10018 only through the owner event-use declaration and sets it on one soccer character', () => {
    const ability = B10018.abilities.find((candidate) => candidate.id === 'a1')!;

    expect(ability).toMatchObject({
      type: 'triggered',
      scope: 'on-hand',
      trigger: { hook: 'effect:declared', selfOnly: true },
      effect: {
        kind: 'atom',
        verb: 'charSetCard',
        args: { player: 'self', fromSelf: true, n: 1, filter: { kind: 'character', trait: 'サッカー' } },
      },
    });
    expect(ability.trigger?.matcher?.({ kind: 'event-use' })).toBe(true);
    expect(ability.trigger?.matcher?.({ kind: 'declared' })).toBe(false);
  });
});
