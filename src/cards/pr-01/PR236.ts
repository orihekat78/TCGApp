// cards/pr-01/PR236 大和敢助 (キャラ) — distinct-name-count micro-cluster (2026-06-21)
// rules: 21-declared-ability-cost.md (【スリープ】= sleepSelf コスト), 17-icons.md (§条件アイコン/【ターン①】),
//        15-abilities-effects.md, 19-special-rules.md (カード名), 07-action-flow.md (effect removal は state 不問)
//
// 公式テキスト:
//   【宣言】【ターン1】【スリープ】：AP5000以下のスリープ状態のキャラを1枚まで選び、リムーブする。
//   【宣言】【ターン1】【スリープ】：AP8000以下のキャラを1枚まで選び、リムーブする。この能力は自分の現場に
//     それぞれカード名の異なる〚特徴［長野県警］〛のキャラが3枚以上いる場合に宣言できる。
//
// a1: 宣言【ターン1】、コスト【スリープ】= sleepSelf。AP5000以下の **スリープ状態** のキャラ (どちらの現場でも)
//     を1枚まで選びリムーブ (exemplar B09006 a1 の sceneRemove state:['sleep'] 形)。
// a2: 宣言【ターン1】、コスト sleepSelf。宣言ゲート (この能力は…場合に宣言できる) = ability.condition に
//     sceneHas distinctNames (自己包含、同名1計数)。AP8000以下のキャラ (状態不問=state filter 無) を1枚まで選びリムーブ。
import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'declared',
  scope: 'on-scene',
  limit: { kind: 'turn', n: 1 },
  // 【スリープ】コスト = 自身をスリープ
  cost: { kind: 'sleepSelf' },
  // AP5000以下のスリープ状態のキャラを1枚まで選び、リムーブする
  effect: { kind: 'atom', verb: 'sceneRemove', args: { player: 'self', max: 1, side: 'either', filter: { apMax: 5000 }, state: ['sleep'] } },
  description: '【宣言】【ターン1】【スリープ】：AP5000以下のスリープ状態のキャラを1枚までリムーブ。',
  ruleRefs: ['rules/17-icons.md', 'rules/21-declared-ability-cost.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'declared',
  scope: 'on-scene',
  limit: { kind: 'turn', n: 1 },
  cost: { kind: 'sleepSelf' },
  // 宣言ゲート: 自分の現場にそれぞれカード名の異なる[長野県警]が3枚以上
  condition: { kind: 'sceneHas', query: { area: 'scene', side: 'self', filter: { trait: '長野県警' }, distinctNames: true }, nMin: 3 },
  // AP8000以下のキャラ (状態不問) を1枚まで選び、リムーブする
  effect: { kind: 'atom', verb: 'sceneRemove', args: { player: 'self', max: 1, side: 'either', filter: { apMax: 8000 } } },
  description: '【宣言】【ターン1】【スリープ】：現場のカード名の異なる[長野県警]3枚以上で、AP8000以下のキャラを1枚までリムーブ。',
  ruleRefs: ['rules/17-icons.md', 'rules/19-special-rules.md', 'rules/21-declared-ability-cost.md'],
};

export const PR236: CardDef = {
  id: 'PR236',
  no: '0934/PR236',
  kind: 'character',
  names: ['大和敢助'],
  colors: ['黄'],
  level: 7,
  ap: 6000,
  lp: 1,
  traits: ['警察', '長野県警'],
  keywords: [],
  rarity: 'PR',
  imageUrl: '1769159370860368.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/19-special-rules.md',
    'rules/21-declared-ability-cost.md',
  ],
};
