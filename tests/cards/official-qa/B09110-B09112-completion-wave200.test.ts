// qa: card:B09110:c6c48c4f8eb604b6a40d12fe2a7833e6d2add2d529e04b3e29c2843f0a5e305c
// qa: card:B09111:1fefea11e9f62644d0760810fefb72ce203d027c2194b205a1bb441878975d27
// qa: card:B09111:ee061ffcf4652d834b2aa83508fd512dedb3e0a2d8251c3d26d6ef0844a5fe36
// qa: card:B09112:3f51aa8485b9e13a1daa1830af8049c5d9c6c1d840cfe9de20e2fee77992ce64

import { describe, expect, it } from 'vitest';
import { B09110 } from '@/cards/ct-p09/B09110';
import { B09111 } from '@/cards/ct-p09/B09111';
import { B09112 } from '@/cards/ct-p09/B09112';

describe('official QA Wave200: CT-P09 declared contracts', () => {
  it('allows B09110 to choose its self-removal branch from the partner area', () => {
    expect(B09110.abilities.find(ability => ability.id === 'a2')).toMatchObject({
      scope: 'on-partner-area',
      effect: {
        kind: 'sequence',
        steps: [
          { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
          { kind: 'choice', options: [expect.anything(), { kind: 'atom', verb: 'sceneRemove', args: { uid: '$self', cause: 'effect' } }] },
        ],
      },
    });
  });

  it('uses B09111 bound card identity after FILE replacement and an exact registered-name declaration', () => {
    expect(B09111.abilities.find(ability => ability.id === 'a2')?.effect).toMatchObject({
      kind: 'chain',
      steps: [
        { kind: 'atom', verb: 'declareName', args: { bind: 'named', domain: 'registered-card-name' } },
        { kind: 'atom', verb: 'fileRemoveTop', args: { player: 'opp', n: 1, bind: 'removed' } },
        { kind: 'atom', verb: 'fileAdd', args: { player: 'opp', n: 1 } },
        {
          kind: 'conditional',
          if: { kind: 'boundNameMatchesDeclared', bindKey: 'removed', declareKey: 'named' },
          then: { kind: 'atom', verb: 'charGrantKeyword', args: { player: 'self', max: 1, kw: '突撃[キャラ]', scope: 'turn' } },
        },
      ],
    });
  });

  it('caps B09112 at the available deck while deferring its named count to resolution', () => {
    expect(B09112.abilities.find(ability => ability.id === 'a2')?.effect).toMatchObject({
      kind: 'sequence',
      steps: [
        { kind: 'atom', verb: 'declareName', args: { bind: 'named', domain: 'registered-card-name' } },
        {
          kind: 'atom',
          verb: 'deckRevealUntil',
          args: {
            player: 'self',
            maxN: { dyn: '$declared.named.sceneNameCount' },
            filter: { cardName: { dyn: '$declared.named' }, kind: 'character' },
            chooseMatch: 'upTo',
          },
        },
        {
          kind: 'conditional',
          if: { kind: 'bound', key: '$matched', presence: 'matched' },
          then: { kind: 'atom', verb: 'handAddFromDeck', args: { player: 'self', cardId: '$matched.cardId' } },
        },
        { kind: 'atom', verb: 'deckToBottomBound', args: { bindKey: '$revealed' } },
      ],
    });
  });
});
