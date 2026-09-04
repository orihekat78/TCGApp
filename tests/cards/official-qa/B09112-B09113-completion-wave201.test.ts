// qa: card:B09112:ee061ffcf4652d834b2aa83508fd512dedb3e0a2d8251c3d26d6ef0844a5fe36
// qa: card:B09113:9179ee748432a89bc4bb8e424ac5aae5a8f117950e7f2f148df4b66db80aedd0
// qa: card:B09113:cc6997867a54241b60eb4f7f08b1dc660071b20baf9ea38fc5e7631c48af9fc0
// qa: card:B09113:e0d277a2b084096ebd90ddd6fbe507fbf5135a16fc85f02a0d5a795f18fcd4b5

import { describe, expect, it } from 'vitest';
import { B09112 } from '@/cards/ct-p09/B09112';
import { B09113 } from '@/cards/ct-p09/B09113';

describe('official QA Wave201: CT-P09 case contracts', () => {
  it('keeps B09112 name selection in the registered-card-name domain', () => {
    const effect = B09112.abilities.find((ability) => ability.id === 'a2')?.effect;
    expect(effect).toMatchObject({ kind: 'sequence' });
    expect((effect as Extract<typeof effect, { kind: 'sequence' }>)?.steps).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'atom', verb: 'declareName', args: expect.objectContaining({ bind: 'named', domain: 'registered-card-name' }) }),
      expect.objectContaining({ kind: 'atom', verb: 'deckRevealUntil', args: expect.objectContaining({ filter: { cardName: { dyn: '$declared.named' }, kind: 'character' } }) }),
    ]));
  });

  it('lets B09113 select any eligible face-down evidence without changing its order', () => {
    expect(B09113.abilities.find((ability) => ability.id === 'a2')?.effect).toMatchObject({
      kind: 'choice',
      options: [
        {
          kind: 'conditional',
          then: {
            kind: 'sequence',
            steps: [
              { kind: 'atom', verb: 'evidenceFlip', args: { cardIds: '$pick.cardIds', max: 1, faceDown: true } },
              { kind: 'conditional', then: { kind: 'atom', verb: 'mill', args: { player: 'opp', n: 2 } } },
            ],
          },
        },
        {
          kind: 'conditional',
          then: {
            kind: 'sequence',
            steps: [
              { kind: 'atom', verb: 'evidenceFlip', args: { cardIds: '$pick.cardIds', max: 3, faceDown: true } },
              { kind: 'conditional', then: { kind: 'atom', verb: 'sceneRemove', args: { max: 1, state: ['sleep'], filter: { levelMax: 7 } } } },
            ],
          },
        },
      ],
    });
  });

  it('retains both B09113 choices while making an unmet branch a no-op', () => {
    expect(B09113.abilities.find((ability) => ability.id === 'a2')?.effect).toMatchObject({
      kind: 'choice',
      chooser: 'self',
      options: [
        { kind: 'conditional', if: { kind: 'scratchTrace', player: 'self', v: '未発見' } },
        {
          kind: 'conditional',
          if: {
            kind: 'and',
            cs: [
              { kind: 'scratchTrace', player: 'self', v: '発見済' },
              { kind: 'sceneHas', query: { area: 'scene', side: 'self', filter: { color: '赤', kind: 'character' } }, nMin: 1 },
              { kind: 'sceneHas', query: { area: 'scene', side: 'self', filter: { color: '黒', kind: 'character' } }, nMin: 1 },
            ],
          },
        },
      ],
    });
  });
});
