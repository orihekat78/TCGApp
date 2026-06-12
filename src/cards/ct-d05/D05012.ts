// cards/ct-d05/D05012 佐藤美和子 (キャラ) — engine-extension #5a batch (D01013 同型・黄)
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
      { kind: 'atom', verb: 'deckRevealUntil', args: { chooseMatch: 'upTo', player: 'self', filter: { color: '黄' }, maxN: 4, bind: '$revealed', bindMatch: '$matched' } },
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
  description: '【登場時】デッキ上から4枚見る → 【黄】を1枚まで手札に加え (取った場合 discard 1) → 残りをデッキ下。',
  ruleRefs: ['rules/14-refresh.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/26-qa-deck-refresh.md'],
};

export const D05012: CardDef = {
  id: 'D05012',
  no: '0078/D05012',
  kind: 'character',
  names: ['佐藤美和子'],
  colors: ['黄'],
  level: 4,
  ap: 4000,
  lp: 1,
  traits: ['警察', '警視庁'],
  keywords: [],
  rarity: 'D',
  imageUrl: '1714013167807968.jpg',
  abilities: [a1],
  ruleRefs: ['rules/14-refresh.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/26-qa-deck-refresh.md'],
};
