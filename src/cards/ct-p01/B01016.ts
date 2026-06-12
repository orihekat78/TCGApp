// cards/ct-p01/B01016 灰原哀 (キャラ C) — engine#5a deck-look-N batch #4 (D01013 完全同型)
// rules: 14-refresh.md, 15-abilities-effects.md, 17-icons.md, 26-qa-deck-refresh.md

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'enter', selfOnly: true },
  effect: {
    kind: 'sequence',
    steps: [
      { kind: 'atom', verb: 'deckRevealUntil', args: { chooseMatch: 'upTo', player: 'self', filter: { color: '青' }, maxN: 4, bind: '$revealed', bindMatch: '$matched' } },
      {
        kind: 'conditional',
        if: { kind: 'bound', key: '$matched', presence: 'matched' },
        then: {
          kind: 'sequence',
          steps: [
            { kind: 'atom', verb: 'handAddFromDeck', args: { player: 'self', cardId: '$matched.cardId' } },
            { kind: 'atom', verb: 'discard', args: { player: 'self', n: 1 } },
          ],
        },
      },
      { kind: 'atom', verb: 'deckToBottomBound', args: { player: 'self', bindKey: '$revealed' } },
    ],
  },
  description: '【登場時】デッキ上から4枚見る → 【青】を1枚まで手札 (取った場合 discard 1) → 残りをデッキ下。',
  ruleRefs: ['rules/14-refresh.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/26-qa-deck-refresh.md'],
};

export const B01016: CardDef = {
  id: 'B01016',
  no: '0012/B01016',
  kind: 'character',
  names: ['灰原哀'],
  colors: ['青'],
  level: 4, ap: 4000, lp: 1,
  traits: ['少年探偵団', '科学者'], keywords: [],
  rarity: 'C',
  imageUrl: '1714012985512478.jpg',
  abilities: [a1],
  ruleRefs: ['rules/14-refresh.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/26-qa-deck-refresh.md'],
};
