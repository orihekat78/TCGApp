// cards/ct-p07/B07088 山村ミサオ (キャラ) — catalog-reuse batch
// rules: 03-field-areas.md, 15-abilities-effects.md, 17-icons.md, 19-special-rules.md, 21-declared-ability-cost.md
//
// 公式テキスト:
//   自分のターン終了時、自分の現場に〚カード名［諸伏景光］〛がいる場合、このキャラをアクティブにする。
//   【宣言】【スリープ】〚手札を1枚リムーブする〛：自分のリムーブエリアにある〚特徴［警察］〛のキャラを1枚まで選び、手札に加える。
//
// a1: 自分のターン終了時 (phase:end:start + turn self) + 現場に[諸伏景光]がいる場合 → このキャラをアクティブに
//     (D08003 a2 phase:end:start / D11016 sceneSetState $self active 同型)。
// a2: 【宣言】【スリープ】〚手札1リム〛 cost (pay: sleepSelf + removeFromHand) で
//     リムーブの[警察]を1枚まで手札へ (D11012 a2 handAddFromRemove / B04008 a1 pay cost 同型)。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  // 自分のターン終了時
  trigger: { hook: 'phase:end:start' },
  condition: { kind: 'turn', player: 'self' },
  effect: {
    kind: 'conditional',
    // 自分の現場に〚カード名［諸伏景光］〛がいる場合
    if: { kind: 'sceneHas', query: { area: 'scene', side: 'self', filter: { cardName: '諸伏景光' } }, nMin: 1 },
    // このキャラをアクティブにする
    then: { kind: 'atom', verb: 'sceneSetState', args: { uid: '$self', state: 'active' } },
  },
  description: '自分のターン終了時、自分の現場に[諸伏景光]がいる場合、このキャラをアクティブにする。',
  ruleRefs: ['rules/03-field-areas.md', 'rules/15-abilities-effects.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'declared',
  scope: 'on-scene',
  // 【スリープ】〚手札を1枚リムーブする〛 (pay で複合コスト)
  cost: {
    kind: 'pay',
    items: [
      { kind: 'sleepSelf' },
      { kind: 'removeFromHand', target: { kind: 'pick', query: { area: 'hand', side: 'self' }, n: { min: 1, max: 1 }, chooser: 'self' }, n: 1 },
    ],
  },
  // 自分のリムーブエリアにある〚特徴［警察］〛のキャラを1枚まで選び、手札に加える。
  effect: { kind: 'atom', verb: 'handAddFromRemove', args: { player: 'self', max: 1, filter: { trait: '警察' } } },
  description: '【宣言】【スリープ】〚手札を1枚リムーブ〛: リムーブエリアの[警察]のキャラを1枚まで選び、手札に加える。',
  ruleRefs: ['rules/19-special-rules.md', 'rules/21-declared-ability-cost.md'],
};

export const B07088: CardDef = {
  id: 'B07088',
  no: '0816/B07088',
  kind: 'character',
  names: ['山村ミサオ'],
  colors: ['黄'],
  level: 6,
  ap: 5000,
  lp: 1,
  traits: ['警察', '群馬県警'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1762414027452727.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md',
  ],
};
