// cards/ct-p02/B02058P 赤井秀一 (character, parallel) — wave leave-reveal-until (engine変更0)
// B02058 と effect 完全同一 (parallel: rarity/imageUrl/no のみ差異)。句マッピングは B02058.ts 参照。
// rules: 03-field-areas.md, 14-refresh.md, 15-abilities-effects.md, 17-icons.md, 26-qa-deck-refresh.md
// 公式テキスト:
//   a1 【登場時】相手の手札が自分の手札の枚数以上ある場合、相手は手札を1枚リムーブする。
//   a2 【相手ターン中】【現場リムーブ時】自分のデッキのカードを上から〚カード名［沖矢昴］〛が出るまで1枚ずつ公開し、それを手札に加える。残りの公開したカードをデッキの下に移し、デッキをシャッフルする。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'enter', selfOnly: true },
  effect: {
    kind: 'conditional',
    if: { kind: 'handCountAtLeastOther', player: 'opp' },
    then: { kind: 'atom', verb: 'discard', args: { player: 'opp', n: 1 } },
  },
  description: '【登場時】相手の手札が自分の手札の枚数以上ある場合、相手は手札を1枚リムーブする。',
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
        args: { visibility: 'public', viewer: 'all', player: 'self', filter: { cardName: '沖矢昴' }, bind: '$revealed', bindMatch: '$matched' },
      },
      {
        kind: 'conditional',
        if: { kind: 'bound', key: '$matched', presence: 'matched' },
        then: { kind: 'atom', verb: 'handAddFromDeck', args: { player: 'self', cardId: '$matched.cardId' } },
      },
      { kind: 'atom', verb: 'deckToBottomBound', args: { player: 'self', bindKey: '$revealed', order: 'preserve' } },
      { kind: 'atom', verb: 'deckShuffle', args: { player: 'self' } },
    ],
  },
  description:
    '【相手ターン中】【現場リムーブ時】自分のデッキのカードを上から〚カード名［沖矢昴］〛が出るまで1枚ずつ公開し、それを手札に加える。残りの公開したカードをデッキの下に移し、デッキをシャッフルする。',
  ruleRefs: ['rules/14-refresh.md', 'rules/17-icons.md', 'rules/26-qa-deck-refresh.md'],
};

export const B02058P: CardDef = {
  id: 'B02058P',
  no: '0221/B02058P',
  kind: 'character',
  names: ['赤井秀一'],
  colors: ['赤'],
  level: 6,
  ap: 5000,
  lp: 1,
  traits: ['赤井家'],
  rarity: 'RP',
  imageUrl: '1721357250091476.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/26-qa-deck-refresh.md',
  ],
};
