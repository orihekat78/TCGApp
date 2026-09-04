// cards/ct-p06/B06048 峰さやか (character) — wave decklook-enter-handadd (engine変更0)
// rules: 14-refresh.md, 15-abilities-effects.md, 17-icons.md, 26-qa-deck-refresh.md
//
// 公式テキスト (ct-p06/character.tsv col11。P 版 B06048P と effect 完全一致):
//   【登場時】自分のデッキのカードを上から3枚見る。その中から〚特徴［YAIBA］〛のカードを1枚まで公開して手札に加え、残りをリムーブエリアに移す。カードを手札に加え、自分の事件が解決編の場合、手札を1枚リムーブする。
//
// 句マッピング (exemplar = B07035 a1 (src/cards/ct-p07/B07035.ts) — tail句含め完全 twin):
//   - 【登場時】 => trigger {hook:'enter', selfOnly:true}
//   - 上から3枚見る + 〚特徴［YAIBA］〛のカードを1枚まで公開して手札に加え
//       => deckRevealUntil{chooseMatch:'upTo', maxN:3, filter:{trait:'YAIBA'}, bind:'$revealed', bindMatch:'$matched'}
//          → conditional(bound $matched matched) → handAddFromDeck{$matched.cardId}
//       ※「のカード」= kind 制約なし (キャラ/イベント問わず YAIBA)。trait は targetFilterToPredicate で honor
//   - 残りをリムーブエリアに移す => boundToRemove{$revealed}
//   - カードを手札に加え、自分の事件が解決編の場合、手札を1枚リムーブする
//       => conditional(and[bound $matched matched, caseStatus '解決編']) → discard{n:1}
//       ※「カードを手札に加え（た）」= $matched 非空 (加えなければ偽 → discard 走らない)
//   ⚠ 句順 pin: handAdd → boundToRemove → 条件 discard (B07035/B09073 と同。discard を先行させると refresh 副作用で非等価)

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
          chooseMatch: 'upTo',
          player: 'self',
          maxN: 3,
          filter: { trait: 'YAIBA' },
          bind: '$revealed',
          bindMatch: '$matched',
        },
      },
      {
        kind: 'conditional',
        if: { kind: 'bound', key: '$matched', presence: 'matched' },
        then: { kind: 'atom', verb: 'handAddFromDeck', args: { player: 'self', cardId: '$matched.cardId', deferRefresh: true } },
      },
      { kind: 'atom', verb: 'boundToRemove', args: { player: 'self', bindKey: '$revealed', refreshAfter: true } },
      {
        kind: 'conditional',
        if: {
          kind: 'and',
          cs: [
            { kind: 'bound', key: '$matched', presence: 'matched' },
            { kind: 'caseStatus', status: '解決編' },
          ],
        },
        then: { kind: 'atom', verb: 'discard', args: { player: 'self', n: 1 } },
      },
    ],
  },
  description:
    '【登場時】自分のデッキのカードを上から3枚見る。その中から〚特徴［YAIBA］〛のカードを1枚まで公開して手札に加え、残りをリムーブエリアに移す。カードを手札に加え、自分の事件が解決編の場合、手札を1枚リムーブする。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/26-qa-deck-refresh.md'],
};

export const B06048: CardDef = {
  id: 'B06048',
  no: '0669/B06048',
  kind: 'character',
  names: ['峰さやか'],
  colors: ['白'],
  level: 4,
  ap: 3000,
  lp: 1,
  traits: ['YAIBA'],
  keywords: [],
  rarity: 'R',
  imageUrl: '1754285220457312.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/26-qa-deck-refresh.md',
  ],
};
