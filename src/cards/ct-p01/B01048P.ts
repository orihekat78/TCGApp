// cards/ct-p01/B01048P 鈴木園子 (パラレル) — B01048 と同型

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'declared',
  scope: 'on-scene',
  cost: { kind: 'sleepSelf' },
  effect: {
    kind: 'sequence',
    steps: [
      {
        kind: 'atom',
        verb: 'deckRevealUntil',
        args: { player: 'self', filter: () => true, maxN: 3, bind: '$revealed', bindMatch: '$matched' },
      },
      {
        kind: 'conditional',
        if: { kind: 'bound', key: '$matched', presence: 'matched' },
        then: { kind: 'atom', verb: 'handAddFromDeck', args: { player: 'self', cardId: '$matched.cardId' } },
      },
      { kind: 'atom', verb: 'deckToBottomBound', args: { player: 'self', bindKey: '$revealed' } },
    ],
  },
  description: '【宣言】【スリープ】 デッキ上から3枚見る → 1枚手札 → 残りをデッキ下。',
  ruleRefs: ['rules/14-refresh.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/21-declared-ability-cost.md'],
};

export const B01048P: CardDef = {
  id: 'B01048P',
  no: '0040/B01048P',
  kind: 'character',
  names: ['鈴木園子'],
  colors: ['白'],
  level: 5, ap: 5000, lp: 1,
  traits: ['高校生', '鈴木財閥'], keywords: [],
  rarity: 'RP',
  imageUrl: '1714013020324343.jpg',
  abilities: [a1],
  ruleRefs: ['rules/14-refresh.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/21-declared-ability-cost.md'],
};
