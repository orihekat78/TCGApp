// cards/ct-p01/B01013 妃英理 (キャラ C) — engine#5a deck-look-N batch #4
// rules: 14-refresh.md, 15-abilities-effects.md, 17-icons.md, 26-qa-deck-refresh.md
//
// 公式テキスト:
//   【登場時】自分のデッキのカードを上から2枚見る。
//     その中からLP0の【青】のキャラを1枚まで公開して手札に加え、残りを好きな順番でデッキの下に移す。
//
// D01013 同型だが maxN=2、filter は LP0 + color:'青' + kind:'character'。
// discard 1 連鎖は本カードには無し (テキスト末尾「カードを手札に加えた場合 手札を1枚リムーブ」が無い)。

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

export const B01013: CardDef = {
  id: 'B01013',
  no: '0009/B01013',
  kind: 'character',
  names: ['妃英理'],
  colors: ['青'],
  level: 4, ap: 3000, lp: 1,
  traits: ['弁護士'], keywords: [],
  rarity: 'C',
  imageUrl: '1714012985501591.jpg',
  abilities: [a1],
  ruleRefs: ['rules/14-refresh.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/26-qa-deck-refresh.md'],
};
