// cards/ct-p01/B01034P 大岡紅葉 (パラレル) — B01034 と同型

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'enter', selfOnly: true },
  effect: {
    kind: 'sequence',
    steps: [
      { kind: 'atom', verb: 'deckRevealUntil', args: { chooseMatch: 'upTo', player: 'self', filter: { color: '緑' }, maxN: 4, bind: '$revealed', bindMatch: '$matched' } },
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
  description: '【登場時】デッキ上から4枚見る → 【緑】を1枚まで手札 (取った場合 discard 1) → 残りをデッキ下。',
  ruleRefs: ['rules/14-refresh.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/26-qa-deck-refresh.md'],
};

export const B01034P: CardDef = {
  id: 'B01034P',
  no: '0028/B01034P',
  kind: 'character',
  names: ['大岡紅葉'],
  colors: ['緑'],
  level: 4, ap: 4000, lp: 1,
  traits: ['高校生'], keywords: [],
  rarity: 'CP',
  imageUrl: '1714013001014650.jpg',
  abilities: [a1],
  ruleRefs: ['rules/14-refresh.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/26-qa-deck-refresh.md'],
};
