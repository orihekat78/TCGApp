// cards/ct-d01/D01013 灰原哀 (キャラ) — engine-extension #5a batch (deck-look-N + handAddFromDeck)
// rules: 14-refresh.md, 15-abilities-effects.md, 17-icons.md, 26-qa-deck-refresh.md
//
// 公式テキスト:
//   【登場時】自分のデッキのカードを上から4枚見る。
//     その中から【青】のカードを1枚まで公開して手札に加え、残りを好きな順番でデッキの下に移す。
//     カードを手札に加えた場合、手札を1枚リムーブする。
//
// engine-extension #5a の verb 構成:
//   1) deckRevealUntil maxN=4 filter={color:'青'} → $matched (青カード1枚 or 空) + $revealed (残り)
//   2) conditional ($matched present) → handAddFromDeck($matched.cardId) → discard 1
//   3) deckToBottomBound $revealed (残りカードをデッキ下へ。"好きな順" は AI=given/UI=任意)

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'enter', selfOnly: true },
  effect: {
    kind: 'sequence',
    steps: [
      // デッキ上から 4 枚見る (maxN=4) — 【青】に該当する 1 枚を $matched に bind
      {
        kind: 'atom',
        verb: 'deckRevealUntil',
        args: {
          chooseMatch: 'upTo',
          player: 'self',
          filter: { color: '青' },
          maxN: 4,
          bind: '$revealed',
          bindMatch: '$matched',
        },
      },
      // 該当があれば 手札に加え、続けて discard 1
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
      // 残りのカードをデッキの下へ
      { kind: 'atom', verb: 'deckToBottomBound', args: { player: 'self', bindKey: '$revealed' } },
    ],
  },
  description:
    '【登場時】デッキ上から4枚見る → 【青】を1枚まで手札に加え (取った場合 discard 1) → 残りをデッキ下。',
  ruleRefs: [
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/26-qa-deck-refresh.md',
  ],
};

// a2: 【ヒラメキ】カードを1枚引く (BUG-140 補修 2026-06-13: TSV hirameki 列の取りこぼし修正) — D03011 a2 同型
const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-evidence',
  trigger: { hook: 'evidence:remove-by-action', optional: true },
  // カードを1枚引く
  effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
  description: '【ヒラメキ】（証拠からリムーブされるときに発動する）カードを1枚引く。',
  ruleRefs: ['rules/10-action-event.md', 'rules/14-refresh.md'],
};

export const D01013: CardDef = {
  id: 'D01013',
  no: '0012/D01013',
  kind: 'character',
  names: ['灰原哀'],
  colors: ['青'],
  level: 4,
  ap: 4000,
  lp: 1,
  traits: ['少年探偵団', '科学者'],
  keywords: [],
  rarity: 'D',
  imageUrl: '1714013100428676.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/26-qa-deck-refresh.md',
  ],
};
