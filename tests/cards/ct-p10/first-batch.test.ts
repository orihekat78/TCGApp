import { describe, expect, it } from 'vitest';

import { B10001 } from '@/cards/ct-p10/B10001.js';
import { B10002 } from '@/cards/ct-p10/B10002.js';
import { B10008 } from '@/cards/ct-p10/B10008.js';
import { B10016 } from '@/cards/ct-p10/B10016.js';
import { B10020 } from '@/cards/ct-p10/B10020.js';
import { B10032 } from '@/cards/ct-p10/B10032.js';
import { B10034 } from '@/cards/ct-p10/B10034.js';

describe('CT-P10 first batch', () => {
  it('defines the three standard partners with their printed identities', () => {
    expect([B10001, B10002, B10020].map(card => [card.id, card.kind, card.colors, card.lp])).toEqual([
      ['B10001', 'partner', ['青'], 1],
      ['B10002', 'partner', ['青'], 1],
      ['B10020', 'partner', ['緑'], 1],
    ]);
    expect(B10001.names).toEqual(['赤木英雄']);
    expect(B10002.names).toEqual(['比護隆佑']);
    expect(B10020.names).toEqual(['沖田総司']);
  });

  it('makes B10008 a contact-scoped AP+2000 cut-in', () => {
    const ability = B10008.abilities[0]!;
    expect(ability.trigger).toMatchObject({ hook: 'effect:declared', optional: true, selfOnly: true });
    expect(ability.effect).toMatchObject({
      kind: 'atom', verb: 'charModifyAP', args: { uid: '$contact.byUid', delta: 2000, scope: 'contact' },
    });
  });

  it('gives B10016 its printed mislead and sleep-guard text abilities', () => {
    expect(B10016.abilities[0]?.description).toContain('ミスリード1');
    expect(B10016.abilities[1]?.continuousModifier?.grantKeywords?.({} as never, {} as never)).toContain('text:sleepGuard');
  });

  it('keeps B10034 hand removal on resolution and its exact evidence cost', () => {
    expect(B10034.abilities[0]).toMatchObject({ type: 'triggered', scope: 'always', trigger: { hook: 'case:to-resolved' } });
    expect(B10034.abilities[1]).toMatchObject({
      type: 'declared', scope: 'always', condition: {
        kind: 'and', cs: [
          { kind: 'caseStatus', status: '解決編' },
          { kind: 'sceneHas', query: { area: 'scene', side: 'self', filter: { color: '緑', trait: '警察' } }, nMin: 2 },
        ],
      }, limit: { kind: 'turn', n: 1 },
      cost: { kind: 'flipFaceUpEvidence', n: { min: 2, max: 2 } },
      effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
    });
  });

  it('makes B10032 grant assault before independently entering a removed police character', () => {
    expect(B10032.abilities[0]).toMatchObject({
      type: 'triggered', scope: 'on-hand', trigger: { hook: 'effect:declared', selfOnly: true },
      condition: { kind: 'partnerColor', color: '緑' },
      effect: {
        kind: 'sequence', steps: [
          { kind: 'atom', verb: 'charGrantKeyword', args: { kw: '突撃[キャラ]', scope: 'turn' } },
          { kind: 'atom', verb: 'sceneEnter', args: { player: 'self', from: 'remove', viaEffect: true } },
        ],
      },
    });
  });
});
