// cards/ct-d08/D08005 灰原哀 (キャラ)
// rules: 13-keywords.md, 15-abilities-effects.md, 17-icons.md, 21-declared-ability-cost.md, 25-qa-effects-resolution.md
// spec: .claude/specs/cards-analysis/D08005.md
//
// 公式テキスト:
//   【自分ターン中】自分の表向きの証拠1つにつき、このキャラをAP＋1000する。
//   【宣言】【ターン1】〚裏向きの証拠を1つ表向きにする〛:
//     ターン終了時までこのキャラは〚突撃〛を持つ。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'continuous',
  scope: 'on-scene',
  condition: { kind: 'turn', player: 'self' },
  // 自分の表向きの証拠1つにつき AP+1000 (read 時に再計算: engine.read.char.ap が走査)
  continuousModifier: { apDelta: { dyn: '$self.faceUpEvidence * 1000' } },
  description: '【自分ターン中】自分の表向きの証拠1つにつき、AP+1000。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/24-qa-naming-stun.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'declared',
  scope: 'on-scene',
  limit: { kind: 'turn', n: 1 },
  cost: { kind: 'flipFaceUpEvidence', n: { min: 1, max: 1 } },
  effect: {
    kind: 'atom',
    verb: 'charGrantKeyword',
    args: { uid: '$self', kw: '突撃', scope: 'turn' },
  },
  description:
    '【宣言】【ターン1】[裏向き証拠1つを表向き]:ターン終了時までこのキャラは〚突撃〛を持つ。',
  ruleRefs: ['rules/21-declared-ability-cost.md', 'rules/13-keywords.md'],
};

export const D08005: CardDef = {
  id: 'D08005',
  no: '0490/D08005',
  kind: 'character',
  names: ['灰原哀'],
  colors: ['青'],
  level: 7,
  ap: 6000,
  lp: 1,
  traits: ['少年探偵団', '科学者'],
  keywords: [],
  rarity: 'D',
  imageUrl: '1743743093446126.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/21-declared-ability-cost.md',
  ],
};
