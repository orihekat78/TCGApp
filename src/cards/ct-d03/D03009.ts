// cards/ct-d03/D03009 鈴木園子 (キャラ) — engine-extension #5a batch (D01013 同型・白)
// rules: 14-refresh.md, 15-abilities-effects.md, 17-icons.md, 26-qa-deck-refresh.md
//
// 公式テキスト:
//   【登場時】自分のデッキのカードを上から4枚見る。
//     その中から【白】のカードを1枚まで公開して手札に加え、残りを好きな順番でデッキの下に移す。
//     カードを手札に加えた場合、手札を1枚リムーブする。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'enter', selfOnly: true },
  effect: {
    kind: 'sequence',
    steps: [
      { kind: 'atom', verb: 'deckRevealUntil', args: { chooseMatch: 'upTo', player: 'self', filter: { color: '白' }, maxN: 4, bind: '$revealed', bindMatch: '$matched' } },
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
  description: '【登場時】デッキ上から4枚見る → 【白】を1枚まで手札に加え (取った場合 discard 1) → 残りをデッキ下。',
  ruleRefs: ['rules/14-refresh.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/26-qa-deck-refresh.md'],
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

export const D03009: CardDef = {
  id: 'D03009',
  no: '0047/D03009',
  kind: 'character',
  names: ['鈴木園子'],
  colors: ['白'],
  level: 4,
  ap: 4000,
  lp: 1,
  traits: ['高校生', '鈴木財閥'],
  keywords: [],
  rarity: 'D',
  imageUrl: '1714013132346216.jpg',
  abilities: [a1, a2],
  ruleRefs: ['rules/14-refresh.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/26-qa-deck-refresh.md'],
};
