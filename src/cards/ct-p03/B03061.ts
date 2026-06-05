// cards/ct-p03/B03061 ルパン (キャラ) — set-card batch #2 (a1 only)
// rules: 15-abilities-effects.md, 16-card-set.md, 17-icons.md
//
// 公式テキスト:
//   【登場時】自分のデッキのカードを上から1枚裏向きでこのキャラにセットする。
//   【宣言】【スリープ】〚このキャラにセットされているカードを1枚リムーブする〛：カードを1枚引く。
//
// a1: enter + $self に 自デッキ上端を裏向きセット (B08054 a2 同型 - declared でなく enter trigger)
// a2: DEFERRED (cost = setCards から 1枚リムーブ — cost system 拡張要)

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'enter', selfOnly: true },
  effect: {
    kind: 'atom',
    verb: 'charSetCard',
    args: { uid: '$self', fromDeckTop: true, faceUp: false, player: 'self' },
  },
  description: '【登場時】自デッキ上端を $self に裏向きセット。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/16-card-set.md', 'rules/17-icons.md'],
};

export const B03061: CardDef = {
  id: 'B03061',
  no: '0316/B03061',
  kind: 'character',
  names: ['ルパン'],
  colors: ['白'],
  level: 4, ap: 3000, lp: 0,
  traits: ['犬'], keywords: [],
  rarity: 'C',
  imageUrl: '1729133406788832.jpg',
  abilities: [a1],
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/16-card-set.md', 'rules/17-icons.md'],
};
