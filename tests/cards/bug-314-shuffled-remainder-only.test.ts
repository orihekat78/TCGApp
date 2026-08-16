// BUG-314: 「残りをシャッフルしてデッキの下」は公開した残りだけを無作為化する。

import { describe, expect, it } from 'vitest';
import { B01022 } from '@/cards/ct-p01/B01022';
import { B02019 } from '@/cards/ct-p02/B02019';
import { B02019P } from '@/cards/ct-p02/B02019P';
import { B03018 } from '@/cards/ct-p03/B03018';
import { B03042 } from '@/cards/ct-p03/B03042';
import { B08026 } from '@/cards/ct-p08/B08026';
import type { CardDef } from '@/engine/types';

type Atom = { kind: 'atom'; verb: string; args: Record<string, unknown> };
type Pair = { bottom: Atom; next: unknown };

const CASES: CardDef[] = [B01022, B02019, B02019P, B03018, B03042, B08026];

function isAtom(value: unknown): value is Atom {
  return typeof value === 'object' && value !== null && (value as { kind?: unknown }).kind === 'atom';
}

function bottomPairs(value: unknown, out: Pair[] = []): Pair[] {
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      if (isAtom(item) && item.verb === 'deckToBottomBound') out.push({ bottom: item, next: value[index + 1] });
      bottomPairs(item, out);
    });
  } else if (typeof value === 'object' && value !== null) {
    Object.values(value as Record<string, unknown>).forEach(item => bottomPairs(item, out));
  }
  return out;
}

describe('BUG-314 shuffled revealed remainder stays below the untouched deck', () => {
  it('locks the exact printed-text family', () => {
    expect(CASES.map(card => card.id)).toEqual(['B01022', 'B02019', 'B02019P', 'B03018', 'B03042', 'B08026']);
  });

  it.each(CASES)('$id randomizes only each bound remainder', card => {
    const pairs = bottomPairs(card.abilities);
    expect(pairs, card.id).toHaveLength(1);
    expect(pairs[0]!.bottom.args, card.id).toMatchObject({ player: 'self', order: 'shuffle' });
    expect(isAtom(pairs[0]!.next) && pairs[0]!.next.verb === 'deckShuffle', card.id).toBe(false);
  });
});
