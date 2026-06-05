// cards/ct-p01/B01053 工藤有希子 (キャラ C) — engine#5a deck-look-N batch #5 variant
// rules: 14-refresh.md, 15-abilities-effects.md, 17-icons.md, 26-qa-deck-refresh.md
//
// 公式テキスト:
//   【登場時】自分のデッキのカードを上から2枚見る。
//     その中からLP2以上の【白】のキャラを1枚まで公開して手札に加え、残りを好きな順番でデッキの下に移す。
//
// B01013 variant — maxN=2 / filter LP≥2【白】キャラ / discard 連鎖無し

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
          player: 'self',
          filter: { color: '白', lpMin: 2, kind: 'character' },
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
  description: '【登場時】デッキ上から2枚見る → LP2以上【白】キャラを1枚まで手札 → 残りをデッキ下。',
  ruleRefs: ['rules/14-refresh.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/26-qa-deck-refresh.md'],
};

export const B01053: CardDef = {
  id: 'B01053',
  no: '0045/B01053',
  kind: 'character',
  names: ['工藤有希子'],
  colors: ['白'],
  level: 4, ap: 3000, lp: 1,
  traits: [], keywords: [],
  rarity: 'C',
  imageUrl: '1714013041160480.jpg',
  abilities: [a1],
  ruleRefs: ['rules/14-refresh.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/26-qa-deck-refresh.md'],
};
