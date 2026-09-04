// cards/pr-01/PR141 灰原哀 (PR variant) — bounce + leave reveal-until
// PR135 と同型 (imageUrl のみ差分、parallel)

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'enter', selfOnly: true },
  condition: {
    kind: 'sceneHas',
    query: { area: 'scene', side: 'self', filter: { cardName: '阿笠博士', levelMin: 6 } },
    nMin: 1,
  },
  effect: {
    kind: 'atom',
    verb: 'sceneToHand',
    args: { player: 'self', max: 1, side: 'opp', filter: { levelMax: 8 } },
  },
  description: '【登場時】自陣 lv6+ 阿笠博士で 相手 level≤8 を 1枚 bounce。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'leave:to-remove', selfOnly: true },
  condition: { kind: 'turn', player: 'opp' },
  effect: {
    kind: 'sequence',
    steps: [
      {
        kind: 'atom',
        verb: 'deckRevealUntil',
        args: {
          visibility: 'public',
          viewer: 'all',
          player: 'self',
          filter: { cardName: '阿笠博士' },
          bind: '$revealed',
          bindMatch: '$matched',
        },
      },
      {
        kind: 'conditional',
        if: { kind: 'bound', key: '$matched', presence: 'matched' },
        then: {
          kind: 'atom',
          verb: 'handAddFromDeck',
          args: { player: 'self', cardId: '$matched.cardId' },
        },
      },
      {
        kind: 'atom',
        verb: 'deckToBottomBound',
        args: { player: 'self', bindKey: '$revealed', order: 'preserve' },
      },
      { kind: 'atom', verb: 'deckShuffle', args: { player: 'self' } },
    ],
  },
  description:
    '【相手ターン中】【現場リムーブ時】自分のデッキのカードを上から〚カード名［阿笠博士］〛が出るまで1枚ずつ公開し、それを手札に加える。残りの公開したカードをデッキの下に移し、デッキをシャッフルする。',
  ruleRefs: ['rules/14-refresh.md', 'rules/17-icons.md', 'rules/26-qa-deck-refresh.md'],
};

export const PR141: CardDef = {
  id: 'PR141',
  no: '0620/PR141',
  kind: 'character',
  names: ['灰原哀'],
  colors: ['青'],
  level: 5, ap: 5000, lp: 1,
  traits: ['少年探偵団', '科学者'], keywords: [],
  rarity: 'PR',
  imageUrl: '1747874027875756.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/26-qa-deck-refresh.md',
  ],
};
