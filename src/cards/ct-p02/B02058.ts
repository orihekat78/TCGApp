// cards/ct-p02/B02058 赤井秀一 (character) — wave leave-reveal-until (engine変更0)
// rules: 03-field-areas.md, 14-refresh.md, 15-abilities-effects.md, 17-icons.md, 26-qa-deck-refresh.md
// 公式テキスト:
//   a1 【登場時】相手の手札が自分の手札の枚数以上ある場合、相手は手札を1枚リムーブする。
//   a2 【相手ターン中】【現場リムーブ時】自分のデッキのカードを上から〚カード名［沖矢昴］〛が出るまで1枚ずつ公開し、それを手札に加える。残りの公開したカードをデッキの下に移し、デッキをシャッフルする。
// 句マッピング:
//   - a1 【登場時】 => trigger{hook:'enter', selfOnly:true}, scope:'on-scene'
//   - 相手の手札が自分の手札の枚数以上ある場合 => condition{kind:'handCountAtLeastOther', player:'opp'}
//       [cond/eval.ts:135 = opp.hand.length >= self.hand.length (Task D E1 2026-06-12)。exemplar B07067 a1 が同一 guard 句で使用。
//        ※ capability-map.txt(2026-06-06 snapshot) の「hand-count condition 不在」は STALE、eval.ts 直参照で確認]
//   - 相手は手札を1枚リムーブする => atom discard{player:'opp', n:1} (必須、chooser=opp が自手札選択)。exemplar D04010/B02063/B06038
//   - a2 = B05021 a1 同型 (leave:to-remove selfOnly + turn:opp + deckRevealUntil{cardName:'沖矢昴'} → handAddFromDeck → deckToBottomBound → deckShuffle)。exemplar B06053 a1。沖矢昴 は登録済 CardDef 名 → match live。

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
        args: { player: 'self', filter: { cardName: '沖矢昴' }, bind: '$revealed', bindMatch: '$matched' },
      },
      {
        kind: 'conditional',
        if: { kind: 'bound', key: '$matched', presence: 'matched' },
        then: { kind: 'atom', verb: 'handAddFromDeck', args: { player: 'self', cardId: '$matched.cardId' } },
      },
      { kind: 'atom', verb: 'deckToBottomBound', args: { player: 'self', bindKey: '$revealed' } },
      { kind: 'atom', verb: 'deckShuffle', args: { player: 'self' } },
    ],
  },
  description:
    '【相手ターン中】【現場リムーブ時】自分のデッキのカードを上から〚カード名［沖矢昴］〛が出るまで1枚ずつ公開し、それを手札に加える。残りの公開したカードをデッキの下に移し、デッキをシャッフルする。',
  ruleRefs: ['rules/14-refresh.md', 'rules/17-icons.md', 'rules/26-qa-deck-refresh.md'],
};

export const B02058: CardDef = {
  id: 'B02058',
  no: '0221/B02058',
  kind: 'character',
  names: ['赤井秀一'],
  colors: ['赤'],
  level: 6,
  ap: 5000,
  lp: 1,
  traits: ['赤井家'],
  rarity: 'R',
  imageUrl: '1721357250088561.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/26-qa-deck-refresh.md',
  ],
};
