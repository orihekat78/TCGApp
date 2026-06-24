// cards/ct-p08/B08009 小林澄子 (キャラ) — catalog-reuse batch
// rules: 10-action-event.md, 13-keywords.md, 15-abilities-effects.md, 19-special-rules.md, 21-declared-ability-cost.md
//
// 公式テキスト:
//   【宣言】【ターン1】【スリープ】〚デッキのカードを上から2枚リムーブする〛：
//     手札からレベル4以下の〚特徴［少年探偵団］〛のキャラを1枚まで登場させる。
//   【ヒラメキ】自分のリムーブエリアにある〚特徴［少年探偵団］〛のキャラを1枚まで選び、手札に加える。
//
// a1: 【宣言】【ターン1】【スリープ】cost = pay(sleepSelf + デッキ上2枚リム) → 手札から Lv4以下[少年探偵団]を1枚まで登場
//     (sceneEnter from:'hand' / B05055 a1 同型 + cost に removeDeckTop n:2 を pay で合成)。
// a2: 【ヒラメキ】リムーブの[少年探偵団]を1枚まで選び、手札に加える (D08013 a2 / B05055 a2 同型)。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'declared',
  scope: 'on-scene',
  limit: { kind: 'turn', n: 1 },
  // 【スリープ】〚デッキのカードを上から2枚リムーブする〛
  cost: { kind: 'pay', items: [{ kind: 'sleepSelf' }, { kind: 'removeDeckTop', player: 'self', n: 2 }] },
  // 手札からレベル4以下の[少年探偵団]のキャラを1枚まで登場させる (候補 0 件 / user skip OK)
  effect: {
    kind: 'choice',
    chooser: 'self',
    options: [
      {
        kind: 'atom',
        verb: 'sceneEnter',
        args: {
          player: 'self', cardId: '$pick.cardId', from: 'hand', viaEffect: true,
          target: { kind: 'pick', query: { area: 'hand', side: 'self', filter: { kind: 'character', trait: '少年探偵団', levelMax: 4 } }, n: { min: 0, max: 1 }, chooser: 'self' },
        },
      },
    ],
  },
  description: '【宣言】【ターン1】【スリープ】〚デッキ上から2枚リムーブ〛：手札からレベル4以下の[少年探偵団]を1枚まで登場させる。',
  ruleRefs: ['rules/21-declared-ability-cost.md', 'rules/15-abilities-effects.md', 'rules/19-special-rules.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-evidence',
  trigger: { hook: 'evidence:remove-by-action', optional: true }, // 任意発動
  // 自分のリムーブエリアにある[少年探偵団]のキャラを1枚まで選び、手札に加える
  effect: { kind: 'atom', verb: 'handAddFromRemove', args: { player: 'self', max: 1, filter: { kind: 'character', trait: '少年探偵団' } } },
  description: '【ヒラメキ】リムーブの[少年探偵団]のキャラを1枚まで選び、手札に加える。',
  ruleRefs: ['rules/10-action-event.md', 'rules/19-special-rules.md'],
};

export const B08009: CardDef = {
  id: 'B08009',
  no: '0850/B08009',
  kind: 'character',
  names: ['小林澄子'],
  colors: ['青'],
  level: 6,
  ap: 5000,
  lp: 1,
  traits: ['教師'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1770731204349203.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/10-action-event.md',
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/19-special-rules.md',
    'rules/21-declared-ability-cost.md',
  ],
};
