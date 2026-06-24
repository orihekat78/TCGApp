// cards/ct-p03/B03115P ラム (character・パラレル) — wave decklook-remove-discard (engine変更0)
// rules: 14-refresh.md, 15-abilities-effects.md, 17-icons.md, 26-qa-deck-refresh.md
//
// 公式テキスト (B03115 と同一効果。P 版は no/rarity/imageUrl のみ異なる — effect 完全一致を TSV で確認済):
//   【登場時】レベル7以下のキャラを1枚まで選び、リムーブする。自分のデッキのカードを上から3枚見る。その中から【カットイン】を持つ【黒】のカードを1枚まで公開して手札に加え、残りを好きな順番でデッキの下に移す。カードを手札に加えた場合、手札を1枚リムーブする。
//
// 句マッピング: B03115.ts と同一 (同テキスト別ファイル full def 慣行)。

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
        verb: 'sceneRemove',
        args: { player: 'self', max: 1, side: 'either', cause: 'effect', filter: { levelMax: 7 } },
      },
      {
        kind: 'atom',
        verb: 'deckRevealUntil',
        args: {
          chooseMatch: 'upTo',
          player: 'self',
          maxN: 3,
          filter: { keyword: 'カットイン', color: '黒' },
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
      {
        kind: 'conditional',
        if: { kind: 'bound', key: '$matched', presence: 'matched' },
        then: { kind: 'atom', verb: 'discard', args: { player: 'self', n: 1 } },
      },
    ],
  },
  description:
    '【登場時】レベル7以下のキャラを1枚まで選び、リムーブする。自分のデッキのカードを上から3枚見る。その中から【カットイン】を持つ【黒】のカードを1枚まで公開して手札に加え、残りを好きな順番でデッキの下に移す。カードを手札に加えた場合、手札を1枚リムーブする。',
  ruleRefs: ['rules/14-refresh.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/26-qa-deck-refresh.md'],
};

export const B03115P: CardDef = {
  id: 'B03115P',
  no: '0364/B03115P',
  kind: 'character',
  names: ['ラム'],
  colors: ['黒'],
  level: 8, ap: 6000, lp: 2,
  traits: ['黒ずくめの組織'], keywords: [],
  rarity: 'RP',
  imageUrl: '1729133483005639.jpg',
  abilities: [a1],
  ruleRefs: ['rules/14-refresh.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/26-qa-deck-refresh.md'],
};
