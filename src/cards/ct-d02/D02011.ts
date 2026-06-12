// cards/ct-d02/D02011 大岡紅葉 (キャラ) — engine-extension #5a batch (D01013 同型・緑)
// rules: 14-refresh.md, 15-abilities-effects.md, 17-icons.md, 26-qa-deck-refresh.md
//
// 公式テキスト:
//   【登場時】自分のデッキのカードを上から4枚見る。
//     その中から【緑】のカードを1枚まで公開して手札に加え、残りを好きな順番でデッキの下に移す。
//     カードを手札に加えた場合、手札を1枚リムーブする。
//
// D01013 と完全同型 (filter color のみ '緑' 差分)

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
  description: '【登場時】デッキ上から4枚見る → 【緑】を1枚まで手札に加え (取った場合 discard 1) → 残りをデッキ下。',
  ruleRefs: ['rules/14-refresh.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/26-qa-deck-refresh.md'],
};

export const D02011: CardDef = {
  id: 'D02011',
  no: '0028/D02011',
  kind: 'character',
  names: ['大岡紅葉'],
  colors: ['緑'],
  level: 4,
  ap: 4000,
  lp: 1,
  traits: ['高校生'],
  keywords: [],
  rarity: 'D',
  imageUrl: '1714013117379010.jpg',
  abilities: [a1],
  ruleRefs: ['rules/14-refresh.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/26-qa-deck-refresh.md'],
};
