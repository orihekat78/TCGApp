import { describe, expect, it } from 'vitest';
import { PR104 } from '@/cards/pr-01/PR104';

describe('PR104 QA gate repair', () => {
  it('keeps the resolved-case declared ability available after entry', () => {
    // qa: card:PR104:2caef4a33ad010091a3f5d3a254509fc73df36c88ade5d64d3f7ccbbe2be3d76
    expect(PR104.abilities.find((ability) => ability.id === 'a2')).toMatchObject({
      type: 'declared',
      condition: { kind: 'caseStatus', status: '解決編' },
      limit: { kind: 'turn', n: 1 },
      effect: { kind: 'atom', verb: 'charModifyAP', args: { uid: '$pick', delta: 1000, scope: 'turn', target: { kind: 'pick', query: { area: 'scene', side: 'self', filter: { trait: '高校生', kind: 'character' }, excludeSelf: true }, n: { min: 0, max: 1 }, chooser: 'self' } } },
    });
  });
});
