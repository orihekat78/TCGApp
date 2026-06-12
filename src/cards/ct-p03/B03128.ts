// cards/ct-p03/B03128 ヘルエンジェル (character C) — engine拡張 wave#2 (filter.keyword cutin-subtype)
// rules: rules/14-refresh.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/20-color-and-switch.md, rules/26-qa-deck-refresh.md
//
// 公式テキスト (TSV ct-p03/character.tsv):
//   【登場時】自分のデッキのカードを上から2枚見る。その中から【カットイン】を持つ【黒】のカードを
//   1枚まで公開して手札に加え、残りを好きな順番でデッキの下に移す。
//
// qAndA (TSV):
//   Q: 条件を満たすカードがあった場合でも手札に加えないことはできますか？ — A: はい、可能です。
//     → 「1枚まで」= 0枚可 (rules/15 + 本Q&A)。chooseMatch:'upTo' で decline channel (BUG-132 GAP-1)
//
// 句マッピング (D01013.ts / B08020.ts a1 と同型。filter のみ差異):
//   - 【登場時】 => trigger {hook:'enter', selfOnly:true}
//   - 自分のデッキのカードを上から2枚見る => deckRevealUntil {player:'self', maxN:2}
//   - 「【カットイン】を持つ【黒】のカード」を1枚まで公開して手札に加え
//       => filter:{keyword:'カットイン', color:'黒'}, chooseMatch:'upTo'
//       — 「カード」なので kind 制限なし (イベントも対象。公式裁定: カード filter)。
//       — keyword presence は印字静的判定 (条件アイコンの有効性は問わない)。
//       => conditional ($matched present) → handAddFromDeck($matched.cardId)
//   - 残りを好きな順番でデッキの下に移す => deckToBottomBound $revealed
//   - ⚠ B08020/D01013 の「加えた場合 discard 1」句は B03128 には無い (TSV で確認) → discard step 不要。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'enter', selfOnly: true },
  effect: {
    kind: 'sequence',
    steps: [
      // 自分のデッキのカードを上から2枚見る — 「【カットイン】を持つ【黒】のカード」を $matched に bind
      {
        kind: 'atom',
        verb: 'deckRevealUntil',
        args: {
          chooseMatch: 'upTo',
          player: 'self',
          filter: { keyword: 'カットイン', color: '黒' },
          maxN: 2,
          bind: '$revealed',
          bindMatch: '$matched',
        },
      },
      // 該当があれば 1枚まで手札に加える (0枚可 — chooseMatch:'upTo' で decline、加えなければ $matched 不在で skip)
      {
        kind: 'conditional',
        if: { kind: 'bound', key: '$matched', presence: 'matched' },
        then: { kind: 'atom', verb: 'handAddFromDeck', args: { player: 'self', cardId: '$matched.cardId' } },
      },
      // 残りを好きな順番でデッキの下に移す
      { kind: 'atom', verb: 'deckToBottomBound', args: { player: 'self', bindKey: '$revealed' } },
    ],
  },
  description:
    '【登場時】自分のデッキのカードを上から2枚見る。その中から【カットイン】を持つ【黒】のカードを1枚まで公開して手札に加え、残りを好きな順番でデッキの下に移す。',
  ruleRefs: [
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/20-color-and-switch.md',
    'rules/26-qa-deck-refresh.md',
  ],
};

export const B03128: CardDef = {
  id: 'B03128',
  no: '0377/B03128',
  kind: 'character',
  names: ['ヘルエンジェル'],
  colors: ['黒'],
  level: 4,
  ap: 3000,
  lp: 1,
  traits: ['黒ずくめの組織'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1729133510408237.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/20-color-and-switch.md',
    'rules/26-qa-deck-refresh.md',
  ],
};
