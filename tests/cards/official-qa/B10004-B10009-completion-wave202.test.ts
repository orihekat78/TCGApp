// qa: card:B10004:0194b74149e29b2d31fa5b6d2a9bf767dfd2a718b7ea50244905b5d5fb423e0b
// qa: card:B10004:a1a08a01622d9551bdceff6e19bd462e9fc6b6f49f36cd7cabf5dc57eed8aaa6
// qa: card:B10004:e725319b76a76f2955f488fe7aca6d11ed83820f06cb3c06a370770ac164845f
// qa: card:B10005:56b2d90b685607e904d39158be2555fcc2be59c6192e97014396a02ba908324f
// qa: card:B10009:3b98bb511de05680d81bddbf8c687fbdfada4b0b487b8b3297c1994d216de105

import { describe, expect, it } from 'vitest';
import { B10004 } from '@/cards/ct-p10/B10004';
import { B10005 } from '@/cards/ct-p10/B10005';
import { B10009 } from '@/cards/ct-p10/B10009';

describe('official QA Wave202: CT-P10 blue contracts', () => {
  it('keeps B10004 soccer-player status continuous and scene-only', () => {
    expect(B10004.abilities.find((ability) => ability.id === 'a1')).toMatchObject({
      type: 'continuous',
      scope: 'on-scene',
      continuousModifier: { grantTraits: ['サッカー選手'] },
    });
  });

  it('requires B10004 to pay its set-card cost and records its third declared use even with no target', () => {
    expect(B10004.abilities.find((ability) => ability.id === 'a2')).toMatchObject({
      limit: { kind: 'turn', n: 3 },
      condition: {
        kind: 'and',
        cs: [
          { kind: 'partnerColor', color: '青' },
          { kind: 'fileAtLeast', n: 5 },
          { kind: 'sceneHas', query: { area: 'scene', side: 'self', excludeSelf: true, filter: { kind: 'character', trait: 'サッカー選手' } }, nMin: 1 },
        ],
      },
      cost: { kind: 'removeSetCard', n: 1, hostSelf: true },
      effect: {
        kind: 'sequence',
        steps: [
          { kind: 'atom', verb: 'sceneRemove', args: { player: 'self', side: 'either', max: 1, filter: { kind: 'character', apMax: 8000 } } },
          { kind: 'conditional', if: { kind: 'sourceDeclaredUseCount', cmp: 'eq', n: 3 }, then: { kind: 'atom', verb: 'evidenceGain', args: { player: 'self', n: 1 } } },
        ],
      },
    });
  });

  it('checks B10005 at the end of its owner turn and B10009 against partner color', () => {
    expect(B10005.abilities.find((ability) => ability.id === 'a1')).toMatchObject({
      type: 'triggered',
      scope: 'on-scene',
      trigger: { hook: 'phase:end:start' },
      condition: {
        kind: 'and',
        cs: [
          { kind: 'turn', player: 'self' },
          { kind: 'sceneHas', query: { area: 'scene', side: 'self', filter: { trait: 'サッカー選手' } }, nMin: 3 },
        ],
      },
      effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
    });
    expect(B10009.abilities.find((ability) => ability.id === 'a1')).toMatchObject({
      type: 'continuous',
      scope: 'on-scene',
      condition: { kind: 'partnerColor', color: '青' },
      continuousModifier: { grantKeywords: expect.any(Function) },
    });
  });
});
