// cards/ct-p01/B01013P 妃英理 (パラレル) — B01013 と同型

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'enter', selfOnly: true },
  effect: {
    kind: 'sequence',
    steps: [
      {
        kind: 'atom',
        verb: 'deckRevealUntil',
        args: {
          player: 'self',
          filter: { color: '青', lpMax: 0, kind: 'character' },
          maxN: 2,
          bind: '$revealed',
          bindMatch: '$matched',
        },
      },
      {
        kind: 'conditional',
        if: { kind: 'bound', key: '$matched', presence: 'matched' },
        then: { kind: 'atom', verb: 'handAddFromDeck', args: { player: 'self', cardId: '$matched.cardId' } },
      },
      { kind: 'atom', verb: 'deckToBottomBound', args: { player: 'self', bindKey: '$revealed' } },
    ],
  },
  description: '【登場時】デッキ上から2枚見る → LP0【青】キャラを1枚まで手札 → 残りをデッキ下。',
  ruleRefs: ['rules/14-refresh.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/26-qa-deck-refresh.md'],
};

export const B01013P: CardDef = {
  id: 'B01013P',
  no: '0009/B01013P',
  kind: 'character',
  names: ['妃英理'],
  colors: ['青'],
  level: 4, ap: 3000, lp: 1,
  traits: ['弁護士'], keywords: [],
  rarity: 'CP',
  imageUrl: '1714012985504571.jpg',
  abilities: [a1],
  ruleRefs: ['rules/14-refresh.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/26-qa-deck-refresh.md'],
};
