// BUG-311: 「残りをデッキ下へ移し、デッキをシャッフル」は並べ替え権を与えない。

import { describe, expect, it } from 'vitest';
import { B01018 } from '@/cards/ct-p01/B01018';
import { B02050 } from '@/cards/ct-p02/B02050';
import { B03028 } from '@/cards/ct-p03/B03028';
import { B03018 } from '@/cards/ct-p03/B03018';
import { B03031 } from '@/cards/ct-p03/B03031';
import { B03031P } from '@/cards/ct-p03/B03031P';
import { B03062 } from '@/cards/ct-p03/B03062';
import { B03062P } from '@/cards/ct-p03/B03062P';
import { B04051 } from '@/cards/ct-p04/B04051';
import { B04051P } from '@/cards/ct-p04/B04051P';
import { B05017 } from '@/cards/ct-p05/B05017';
import { B05042 } from '@/cards/ct-p05/B05042';
import { B05077 } from '@/cards/ct-p05/B05077';
import { B05114 } from '@/cards/ct-p05/B05114';
import { B06010 } from '@/cards/ct-p06/B06010';
import { B06011 } from '@/cards/ct-p06/B06011';
import { B06011P } from '@/cards/ct-p06/B06011P';
import { B06053 } from '@/cards/ct-p06/B06053';
import { B06053P } from '@/cards/ct-p06/B06053P';
import { B07038 } from '@/cards/ct-p07/B07038';
import { B07043 } from '@/cards/ct-p07/B07043';
import { B07052 } from '@/cards/ct-p07/B07052';
import { B07086 } from '@/cards/ct-p07/B07086';
import { B08060 } from '@/cards/ct-p08/B08060';
import { B08060P } from '@/cards/ct-p08/B08060P';
import { B09109 } from '@/cards/ct-p09/B09109';
import { B09109P } from '@/cards/ct-p09/B09109P';
import { D10003 } from '@/cards/ct-d10/D10003';
import { D10004 } from '@/cards/ct-d10/D10004';
import { D11019 } from '@/cards/ct-d11/D11019';
import { PR117 } from '@/cards/pr-01/PR117';
import { PR118 } from '@/cards/pr-01/PR118';
import { PR135 } from '@/cards/pr-01/PR135';
import { PR141 } from '@/cards/pr-01/PR141';
import { PR195 } from '@/cards/pr-01/PR195';
import type { CardDef } from '@/engine/types';

type Atom = { kind: 'atom'; verb: string; args: Record<string, unknown> };
type Pair = { bottom: Atom; next: unknown };

const CASES: Array<{ def: CardDef; bindKey?: string; count?: number }> = [
  { def: D10003 }, { def: D10004 }, { def: D11019 }, { def: B01018 },
  { def: B02050 }, { def: B03028 }, { def: B03031 }, { def: B03031P },
  { def: B03062 }, { def: B03062P }, { def: B04051 }, { def: B04051P },
  { def: B05017 }, { def: B05042 }, { def: B05077 }, { def: B05114 },
  { def: B06010 }, { def: B06011 }, { def: B06011P }, { def: B06053 },
  { def: B06053P }, { def: B07038 }, { def: B07043, count: 3 }, { def: B07052 },
  { def: B07086 }, { def: B08060 }, { def: B08060P },
  { def: B09109, bindKey: 'restRevealed' }, { def: B09109P, bindKey: 'restRevealed' },
  { def: PR117 }, { def: PR118 }, { def: PR135 }, { def: PR141 }, { def: PR195 },
];

const ALIASES: Array<{ left: CardDef; right: CardDef }> = [
  { left: D10003, right: D10004 }, { left: B03031, right: B03031P },
  { left: B03062, right: B03062P }, { left: B04051, right: B04051P },
  { left: B06011, right: B06011P }, { left: B06053, right: B06053P },
  { left: B08060, right: B08060P }, { left: B09109, right: B09109P },
  { left: PR117, right: PR118 }, { left: PR135, right: PR141 },
];

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

describe('BUG-311 forced reveal remainder ordering', () => {
  it('locks the exact grounded family and exclusions', () => {
    const ids = CASES.map(({ def }) => def.id);
    expect(ids).toHaveLength(34);
    expect(new Set(ids).size).toBe(34);
    expect(ids).not.toContain(B03018.id);
    expect(bottomPairs(B03018.abilities).every(({ bottom }) => bottom.args.order !== 'preserve')).toBe(true);
  });

  it.each(CASES)('$def.id preserves every remainder and shuffles immediately', ({ def, bindKey = '$revealed', count = 1 }) => {
    const pairs = bottomPairs(def.abilities);
    expect(pairs, def.id).toHaveLength(count);
    for (const { bottom, next } of pairs) {
      expect(bottom.args, def.id).toMatchObject({ player: 'self', bindKey, order: 'preserve' });
      expect(next, def.id).toEqual({ kind: 'atom', verb: 'deckShuffle', args: { player: 'self' } });
    }
  });

  it.each(ALIASES)('$left.id and $right.id keep identical serialized ability contracts', ({ left, right }) => {
    expect(JSON.parse(JSON.stringify(right.abilities))).toEqual(JSON.parse(JSON.stringify(left.abilities)));
  });
});
