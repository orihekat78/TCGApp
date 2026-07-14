import { describe, expect, it } from 'vitest';
import { B08078 } from '@/cards/ct-p08/B08078';
import { B08078P } from '@/cards/ct-p08/B08078P';

function normalized(card: typeof B08078): unknown {
  const { id: _id, rarity: _rarity, imageUrl: _imageUrl, ...rest } = card;
  return rest;
}

describe('B08078 ジン', () => {
  it('requires blue-and-black case plus two remove-area leave abilities before declaration', () => {
    const a1 = B08078.abilities[0]!;
    expect(a1).toMatchObject({
      type: 'declared', cost: { kind: 'sleepSelf' },
      condition: { kind: 'and', cs: [
        { kind: 'caseColor', color: ['青', '黒'], combine: 'and' },
        { kind: 'removeFilterAtLeast', player: 'self', filters: [{ kind: 'character', keyword: '現場リムーブ時' }], n: 2 },
      ] },
    });
  });

  it('keeps the opponent-turn leave trigger as optional discard, draw, optional invoke', () => {
    expect(B08078.abilities[1]).toMatchObject({
      type: 'triggered', condition: { kind: 'turn', player: 'opp' }, trigger: { hook: 'leave:to-remove', selfOnly: true },
      effect: { kind: 'optional', effect: { kind: 'chain', steps: [
        { kind: 'atom', verb: 'discard', args: { bind: '$removed', filter: { keyword: '現場リムーブ時', levelMax: 7, color: ['青', '黒'] } } },
        { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
        { kind: 'optional', effect: { kind: 'atom', verb: 'invokeLeaveToRemoveOfCard', args: { cardId: '$removed.cardId' } } },
      ] } },
    });
  });

  it('P is semantically identical to the base print', () => {
    expect(normalized(B08078P)).toEqual(normalized(B08078));
  });
});
