import { describe, expect, it } from 'vitest';
import { B06103 } from '@/cards/ct-p06/B06103';
import { B06103P } from '@/cards/ct-p06/B06103P';

function normalized(card: typeof B06103): unknown {
  const { id: _id, rarity: _rarity, imageUrl: _imageUrl, ...rest } = card;
  return JSON.parse(JSON.stringify(rest).replaceAll('B06103P', 'B06103')) as unknown;
}

describe('B06103 ジン', () => {
  it('is hand-declared, removes a friendly black character, enters asleep, then arms the named restriction', () => {
    expect(B06103.abilities[0]).toMatchObject({
      type: 'declared', scope: 'on-hand', condition: { kind: 'caseStatus', status: '解決編' },
      cost: { kind: 'removeFromScene', target: { query: { area: 'scene', side: 'self', filter: { kind: 'character', color: '黒' } } } },
      effect: { kind: 'sequence', steps: [
        { kind: 'atom', verb: 'sceneEnter', args: { cardId: 'B06103', from: 'hand', enterSleep: true } },
        { kind: 'atom', verb: 'setUseEnterBanCardName', args: { cardName: 'ジン' } },
      ] },
    });
  });

  it('P is semantically identical to the base print', () => {
    expect(normalized(B06103P)).toEqual(normalized(B06103));
  });
});
