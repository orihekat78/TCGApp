// qaId=card:D10003:4689299fe2afbf504961c70924f98834b6cd2f951f983d07c9d233c675052f2f
// qaId=card:D10004:4689299fe2afbf504961c70924f98834b6cd2f951f983d07c9d233c675052f2f
// qaId=card:D10005:4689299fe2afbf504961c70924f98834b6cd2f951f983d07c9d233c675052f2f
// qaId=card:D10006:4689299fe2afbf504961c70924f98834b6cd2f951f983d07c9d233c675052f2f
// qaId=card:D10009:4689299fe2afbf504961c70924f98834b6cd2f951f983d07c9d233c675052f2f
// qaId=card:D10010:4689299fe2afbf504961c70924f98834b6cd2f951f983d07c9d233c675052f2f
import { beforeEach, describe, expect, it } from 'vitest';
import { D10003 } from '@/cards/ct-d10/D10003';
import { D10004 } from '@/cards/ct-d10/D10004';
import { D10005 } from '@/cards/ct-d10/D10005';
import { D10006 } from '@/cards/ct-d10/D10006';
import { D10009 } from '@/cards/ct-d10/D10009';
import { D10010 } from '@/cards/ct-d10/D10010';
import { setup, type DeckPair } from '@/engine/flow/setup';
import { produce } from '@/engine/produce';
import { _resetRegistry, register } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import type { CardDef, PlayerSide } from '@/engine/types';

const PARTNER = fixture('D10_QA_PARTNER', 'partner');
const CASE = fixture('D10_QA_CASE', 'case');
const FILLER = { ...fixture('D10_QA_FILLER'), deckLimit: 'unlimited' as const };
const PRINTINGS = [D10003, D10004, D10005, D10006, D10009, D10010] as const;

function fixture(id: string, kind: CardDef['kind'] = 'character'): CardDef {
  return {
    id, no: id, kind, names: [id], colors: ['blue'], level: 1, ap: 1000, lp: 1,
    traits: [], keywords: [], rarity: 'T', imageUrl: '', abilities: [], ruleRefs: [],
  };
}

function decksWith(
  primary: CardDef,
  primaryCount: number,
  alternate: CardDef,
  alternateCount: number,
  side: PlayerSide = 'self',
): DeckPair {
  const selected = [
    ...Array<string>(primaryCount).fill(primary.id),
    ...Array<string>(alternateCount).fill(alternate.id),
    ...Array<string>(40 - primaryCount - alternateCount).fill(FILLER.id),
  ];
  const fillerDeck = Array<string>(40).fill(FILLER.id);
  const pair: DeckPair = {
    self: { partnerId: PARTNER.id, caseId: CASE.id, mainCards: fillerDeck },
    opp: { partnerId: PARTNER.id, caseId: CASE.id, mainCards: fillerDeck },
  };
  pair[side] = { partnerId: PARTNER.id, caseId: CASE.id, mainCards: selected };
  return pair;
}

function initialize(
  primary: CardDef,
  primaryCount: number,
  alternate: CardDef,
  alternateCount: number,
  side: PlayerSide = 'self',
): void {
  produce(createEmptyGameState(), draft => {
    setup.init(draft, decksWith(primary, primaryCount, alternate, alternateCount, side));
  });
}

beforeEach(() => {
  _resetRegistry();
  for (const card of [PARTNER, CASE, FILLER, ...PRINTINGS]) register(card);
});

describe('official Q&A: alternate printings share the three-copy limit', () => {
  it('aggregates D10003 and D10004 as official card 0838', () => {
    expect(D10003.no.split('/')[0]).toBe('0838');
    expect(D10004.no.split('/')[0]).toBe('0838');
    for (const [base, alternate] of [[3, 0], [2, 1], [1, 2], [0, 3]]) {
      expect(() => initialize(D10003, base, D10004, alternate)).not.toThrow();
    }
    for (const [base, alternate] of [[3, 1], [2, 2], [4, 0]]) {
      expect(() => initialize(D10003, base, D10004, alternate)).toThrow(/self.*COPY_LIMIT/);
    }
  });

  it('aggregates D10005 and D10006 as official card 0839', () => {
    expect(D10005.no.split('/')[0]).toBe('0839');
    expect(D10006.no.split('/')[0]).toBe('0839');
    for (const [base, alternate] of [[3, 0], [2, 1], [1, 2], [0, 3]]) {
      expect(() => initialize(D10005, base, D10006, alternate)).not.toThrow();
    }
    for (const [base, alternate] of [[3, 1], [2, 2], [4, 0]]) {
      expect(() => initialize(D10005, base, D10006, alternate)).toThrow(/self.*COPY_LIMIT/);
    }
  });

  it('aggregates D10009 and D10010 as official card 0840 on either side', () => {
    expect(D10009.no.split('/')[0]).toBe('0840');
    expect(D10010.no.split('/')[0]).toBe('0840');
    for (const [base, alternate] of [[3, 0], [2, 1], [1, 2], [0, 3]]) {
      expect(() => initialize(D10009, base, D10010, alternate)).not.toThrow();
    }
    expect(() => initialize(D10009, 3, D10010, 1, 'opp')).toThrow(/opp.*COPY_LIMIT/);
  });

  it('does not combine different official IDs that share this Q&A rule', () => {
    const decks = decksWith(D10003, 3, D10004, 0);
    decks.self.mainCards.splice(3, 3, D10005.id, D10005.id, D10005.id);
    expect(() => produce(createEmptyGameState(), draft => setup.init(draft, decks))).not.toThrow();
  });
});
