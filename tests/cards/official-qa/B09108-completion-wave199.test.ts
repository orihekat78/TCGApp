// qa: card:B09108:0643b41835d29ed2fe718d2fe0b916ea3a9086713081a1b6c5e9c0517dfe99a7
// qa: card:B09108:0ae647669c43a49b9ad408264f0e80c5c5d6f5169c0d2d4aa382d127006777eb
// qa: card:B09108:628fe49da7ac3d0ac5a5fdbb23a36f02bd9d278f640322cab14399ff90ba9fda
// qa: card:B09108:ee061ffcf4652d834b2aa83508fd512dedb3e0a2d8251c3d26d6ef0844a5fe36

import { describe, expect, it } from 'vitest';
import { B09108 } from '@/cards/ct-p09/B09108';

describe('official QA Wave199: B09108 declared contracts', () => {
  it('keeps the first declared ability as a sequence when its FILE flip is already a no-op', () => {
    expect(B09108.abilities.find(ability => ability.id === 'a1')?.effect).toMatchObject({
      kind: 'sequence',
      steps: [
        { kind: 'atom', verb: 'sceneToDeck', args: { player: 'self', side: 'opp', max: 1, pos: 'bottom' } },
        { kind: 'atom', verb: 'fileFlipTop', args: { player: 'opp' } },
      ],
    });
  });

  it('retains the removed-card binding through FILE replacement before the matching follow-up', () => {
    expect(B09108.abilities.find(ability => ability.id === 'a2')?.effect).toMatchObject({
      kind: 'chain',
      steps: [
        { kind: 'atom', verb: 'declareName', args: { bind: 'named', domain: 'registered-card-name' } },
        { kind: 'atom', verb: 'fileRemoveTop', args: { player: 'opp', n: 1, bind: 'removed' } },
        { kind: 'atom', verb: 'fileAdd', args: { player: 'opp', n: 1 } },
        {
          kind: 'conditional',
          if: { kind: 'boundNameMatchesDeclared', bindKey: 'removed', declareKey: 'named' },
          then: {
            kind: 'sequence',
            steps: [
              { kind: 'atom', verb: 'draw', args: { player: 'self', n: 2 } },
              { kind: 'atom', verb: 'discard', args: { player: 'self', n: 2 } },
            ],
          },
        },
      ],
    });
  });
});
