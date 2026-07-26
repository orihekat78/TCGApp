import { describe, expect, it } from 'vitest';
import { B10067, B10067P, B10067P2, B10067P3 } from '@/cards/ct-p10/B10067';
import { B10068, B10068P, B10068P2 } from '@/cards/ct-p10/B10068';
import { B10070, B10070P } from '@/cards/ct-p10/B10070';
import { B10071, B10071P } from '@/cards/ct-p10/B10071';

describe('CT-P10 60s police cluster', () => {
  it('B10067 has printed assault and every named bond clause', () => {
    expect(B10067).toMatchObject({ id: 'B10067', names: ['降谷零'], keywords: ['突撃'] });
    expect(B10067.abilities).toHaveLength(4);
    expect(B10067.abilities[0]).toMatchObject({ continuousModifier: { grantKeywords: expect.any(Function) } });
    expect(B10067.abilities[1]).toMatchObject({ trigger: { hook: 'phase:end:start' } });
  });

  it('B10068 removes an AP8000-or-less character on entry and resolves the two-card look fully', () => {
    expect(B10068).toMatchObject({ id: 'B10068', names: ['諸伏景光'], level: 8, ap: 7000 });
    expect(B10068.abilities[0]).toMatchObject({
      trigger: { hook: 'enter', selfOnly: true },
      effect: { kind: 'atom', verb: 'sceneRemove', args: { filter: { apMax: 8000 } } },
    });
    expect(B10068.abilities[1]?.effect).toMatchObject({ kind: 'sequence' });
    expect((B10068.abilities[1]?.effect as { steps: unknown[] }).steps).toHaveLength(3);
  });

  it('B10070 grants assault only from three printed Shippu cards in remove, then uses first-entry Shippu', () => {
    expect(B10070).toMatchObject({ id: 'B10070', names: ['萩原千速'] });
    expect(B10070.abilities[0]).toMatchObject({
      type: 'continuous',
      condition: { kind: 'removeFilterAtLeast', n: 3, filters: [{ keyword: '疾風' }] },
    });
    expect(B10070.abilities[1]).toMatchObject({ trigger: { hook: 'enter', selfOnly: true, matcherCondition: { kind: 'enterOrderEquals', n: 1 } } });
  });

  it('B10071 combines Misread 3, opponent case-action wakeup, and the Morofushi return declaration', () => {
    expect(B10071).toMatchObject({ id: 'B10071', names: ['山村ミサオ'], lp: 0 });
    expect(B10071.abilities).toHaveLength(3);
    expect(B10071.abilities[1]).toMatchObject({ trigger: { hook: 'action:declare' }, condition: { kind: 'and', cs: expect.any(Array) } });
    expect(B10071.abilities[2]).toMatchObject({ type: 'declared', condition: { kind: 'bond', cardName: '諸伏景光' } });
  });

  it('exports every same-text print in this cluster with its own card ID', () => {
    expect([B10067P.id, B10067P2.id, B10067P3.id, B10068P.id, B10068P2.id, B10070P.id, B10071P.id])
      .toEqual(['B10067P', 'B10067P2', 'B10067P3', 'B10068P', 'B10068P2', 'B10070P', 'B10071P']);
  });
});
