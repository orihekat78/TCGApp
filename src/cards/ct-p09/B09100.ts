// cards/ct-p09/B09100 犯人 (キャラ) — catalog-reuse batch
// rules: 02-deck-construction.md, 15-abilities-effects.md, 17-icons.md, 21-declared-ability-cost.md
//
// 公式テキスト:
//   犯人［ID：1039］はデッキに何枚でも入れることができる。
//   【宣言】【ターン1】【スリープ】：AP8000以下のキャラを1枚まで選び、リムーブする。
//
// 「デッキに何枚でも入れられる」はデッキ構築時のルール (rules/02) であり、ゲーム中の能力 hook ではない。
// a1: 【宣言】【ターン1】【スリープ】cost sleepSelf → AP8000以下のキャラを1枚まで選びリムーブ (D11003 a2 同型)

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'declared',
  scope: 'on-scene',
  limit: { kind: 'turn', n: 1 }, // 【ターン1】
  cost: { kind: 'sleepSelf' }, // 【スリープ】
  // AP8000以下のキャラを1枚まで選び、リムーブする
  effect: { kind: 'atom', verb: 'sceneRemove', args: { player: 'self', max: 1, side: 'either', cause: 'effect', filter: { apMax: 8000 } } },
  description: '【宣言】【ターン1】【スリープ】：AP8000以下のキャラを1枚まで選び、リムーブする。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/21-declared-ability-cost.md'],
};

export const B09100: CardDef = {
  id: 'B09100',
  no: '1039/B09100',
  kind: 'character',
  names: ['犯人'],
  colors: ['黒'],
  level: 8,
  ap: 7000,
  lp: 1,
  traits: ['犯人'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1775608943928235.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/02-deck-construction.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md',
  ],
};
