// cards/ct-p06/B06048P 峰さやか (character・パラレル) — wave decklook-enter-handadd (engine変更0)
// rules: 14-refresh.md, 15-abilities-effects.md, 17-icons.md, 26-qa-deck-refresh.md
//
// 公式テキスト (B06048 と同一効果。P 版は no/rarity/imageUrl のみ異なる — effect 完全一致を TSV で確認済):
//   【登場時】自分のデッキのカードを上から3枚見る。その中から〚特徴［YAIBA］〛のカードを1枚まで公開して手札に加え、残りをリムーブエリアに移す。カードを手札に加え、自分の事件が解決編の場合、手札を1枚リムーブする。
//
// 句マッピング: B06048.ts と同一 (同テキスト別ファイル full def 慣行)。

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
        then: { kind: 'atom', verb: 'handAddFromDeck', args: { player: 'self', cardId: '$matched.cardId' } },
      },
      { kind: 'atom', verb: 'boundToRemove', args: { player: 'self', bindKey: '$revealed' } },
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

export const B06048P: CardDef = {
  id: 'B06048P',
  no: '0669/B06048P',
  kind: 'character',
  names: ['峰さやか'],
  colors: ['白'],
  level: 4,
  ap: 3000,
  lp: 1,
  traits: ['YAIBA'],
  keywords: [],
  rarity: 'RP',
  imageUrl: '1755684948585653.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/26-qa-deck-refresh.md',
  ],
};
