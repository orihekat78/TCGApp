// cards/ct-p05/B05029 大岡紅葉 (キャラ R) — engine#5b charSetCard batch #3 (a1 only)
// rules: 15-abilities-effects.md, 16-card-set.md, 17-icons.md, 21-declared-ability-cost.md
//
// 公式テキスト:
//   【宣言】【スリープ】：自分の現場にいるキャラを1枚まで選び、自分のデッキのカードを
//     上から1枚裏向きでセットする。
//   【パートナー緑】【宣言】【ターン1】自分か相手の現場にいるキャラに裏向きでセットされている
//     カードを合わせて2枚リムーブしてもよい。（自分と相手で1枚ずつリムーブできる）
//     そうした場合、レベル7以下のキャラを1枚まで選び、リムーブする。
//
// a1: 【宣言】【スリープ】 自陣 1pick + self-deck setCard (B02030 a2 同型)
// a2: DEFERRED (custom cost: 自分/相手 setCards 合計 2 枚リムーブ — cost system 拡張要)

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'declared',
  scope: 'on-scene',
  cost: { kind: 'sleepSelf' },
  effect: {
    kind: 'atom',
    verb: 'charSetCard',
    args: { player: 'self', max: 1, side: 'self', fromDeckTop: true, faceUp: false },
  },
  description: '【宣言】【スリープ】自陣 1枚に 自デッキ上端裏向きセット。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/16-card-set.md', 'rules/17-icons.md', 'rules/21-declared-ability-cost.md'],
};

export const B05029: CardDef = {
  id: 'B05029',
  no: '0533/B05029',
  kind: 'character',
  names: ['大岡紅葉'],
  colors: ['緑'],
  level: 7, ap: 5000, lp: 1,
  traits: ['高校生'], keywords: [],
  rarity: 'R',
  imageUrl: '1745322178439599.jpg',
  abilities: [a1],
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/16-card-set.md', 'rules/17-icons.md', 'rules/21-declared-ability-cost.md'],
};
