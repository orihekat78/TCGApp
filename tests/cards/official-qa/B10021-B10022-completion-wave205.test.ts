// qa: card:B10021:14c40cd37416c012f1937fc6b69773ea941cea21f875ffaabbfeb0e1eb286a4c
// qa: card:B10021:4b18aa818758ffcd6c8520820ecad1636f2c8078a3b5244ccc53346c884db74c
// qa: card:B10022:4d7124f5847fc84070da4126228f82e30d156516e59f9c909a05ce31f640fbda
// qa: card:B10022:b28b7e81f684a02f22f62ec571f745928832a0832a16216b7f2c8646fe2fb9b7

import { describe, expect, it } from 'vitest';
import { B10021 } from '@/cards/ct-p10/B10021';
import { B10022 } from '@/cards/ct-p10/B10022';

describe('official QA Wave205: CT-P10 green declared-cost contracts', () => {
  it('counts B10021 itself among the two required own Police characters', () => {
    const ability = B10021.abilities.find((candidate) => candidate.id === 'a1')!;

    expect(B10021.traits).toContain('警察');
    expect(ability).toMatchObject({
      type: 'declared',
      condition: {
        kind: 'and',
        cs: [
          { kind: 'partnerColor', color: '緑' },
          { kind: 'sceneHas', query: { area: 'scene', side: 'self', filter: { trait: '警察' } }, nMin: 2 },
        ],
      },
    });
  });

  it('keeps B10021 partner-area set removal as one declared ability cost', () => {
    expect(B10021.abilities.find((candidate) => candidate.id === 'a2')).toMatchObject({
      type: 'declared',
      scope: 'on-partner-area',
      cost: { kind: 'removeSetCard', n: 1 },
    });
  });

  it('allows B10022 to pay from either eligible own host branch', () => {
    expect(B10022.abilities.find((candidate) => candidate.id === 'a2')).toMatchObject({
      type: 'declared',
      cost: {
        kind: 'removeSetCard',
        n: 2,
        face: 'down',
        hostQuery: {
          area: 'scene',
          side: 'self',
          filterAny: [{ cardName: '服部平次' }, { color: '緑', trait: '警察' }],
        },
      },
    });
  });

  it('does not use an opponent host for B10022 declared-cost payment', () => {
    const cost = B10022.abilities.find((candidate) => candidate.id === 'a2')!.cost!;

    expect(cost).toMatchObject({ kind: 'removeSetCard', hostQuery: { side: 'self' } });
    expect(JSON.stringify(cost)).not.toContain('"side":"either"');
  });
});
