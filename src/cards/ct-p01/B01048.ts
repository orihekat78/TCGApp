// cards/ct-p01/B01048 鈴木園子 (キャラ R) — engine#5a deck-look-N batch #5 variant
// rules: 14-refresh.md, 15-abilities-effects.md, 17-icons.md, 21-declared-ability-cost.md, 26-qa-deck-refresh.md
//
// 公式テキスト:
//   【宣言】【スリープ】：自分のデッキのカードを上から3枚見る。
//     その中からカードを1枚手札に加え、残りを好きな順番でデッキの下に移す。
//
// declared sleep cost / maxN=3 / 全カード hand-add (filter なし) / discard 連鎖無し
// "1枚手札に加え" は強制 (まで 無し) — 公式は max=1 でなく n=1 だが、最低 1 枚を取る必要がある
// engine 実装では simplification として max:1 で表現 (デッキ 0 枚の場合は no-op)

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'declared',
  scope: 'on-scene',
  cost: { kind: 'sleepSelf' },
  effect: {
    kind: 'sequence',
    steps: [
      {
        kind: 'atom',
        verb: 'deckRevealUntil',
        args: {
          player: 'self',
          filter: () => true,
          maxN: 3,
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
  description: '【宣言】【スリープ】 デッキ上から3枚見る → 1枚手札 → 残りをデッキ下。',
  ruleRefs: ['rules/14-refresh.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/21-declared-ability-cost.md'],
};

export const B01048: CardDef = {
  id: 'B01048',
  no: '0040/B01048',
  kind: 'character',
  names: ['鈴木園子'],
  colors: ['白'],
  level: 5, ap: 5000, lp: 1,
  traits: ['高校生', '鈴木財閥'], keywords: [],
  rarity: 'R',
  imageUrl: '1714013020321565.jpg',
  abilities: [a1],
  ruleRefs: ['rules/14-refresh.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/21-declared-ability-cost.md'],
};
