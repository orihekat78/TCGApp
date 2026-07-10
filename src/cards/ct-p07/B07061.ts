// cards/ct-p07/B07061 日輪の後光の巻 (事件) — Cluster WB1 exemplar (toPartnerArea pick-form)
// rules: 01-victory-conditions.md, 03-field-areas.md, 15-abilities-effects.md, 17-icons.md, 21-declared-ability-cost.md
// 公式テキスト:
//   この事件が解決編になったとき、自分は手札を1枚リムーブする。
//   【解決編】【宣言】【ターン1】〚裏向きの証拠を1つ表向きにする〛：自分のリムーブエリアにある〚特徴［ビッグジュエル］〛のカードを1枚まで選び、パートナーエリアに移す。
// 句マッピング:
//   - a1「解決編になったとき手札1枚リムーブ」=> triggered case:to-resolved selfOnly → discard{player:'self', n:1}
//     (D08026 a1 と同一テキスト・同型)。
//   - a2 gate【解決編】=> condition caseStatus:'解決編' / limit turn 1。
//   - a2 コスト〚裏向き証拠を1つ表向き〛=> flipFaceUpEvidence n:{min:1,max:1} (「1つ」= ちょうど1、D08005 同型)。
//   - a2 効果「リムーブの〚ビッグジュエル〛カード1枚まで選び PA へ移す」=> toPartnerArea 短縮形
//     {player:'self', max:1, filter:{trait:'ビッグジュエル'}}。★ Cluster WB1 で toPartnerArea の pick-form を
//     解禁 (従来 self-only)。remove→PA は addAreaCardFromRemove (remove splice + remove:exit + PA push、上限なし)。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'always',
  trigger: {
    hook: 'case:to-resolved',
    selfOnly: true
  },
  effect: { kind: 'atom', verb: 'discard', args: { player: 'self', n: 1 } },
  description: 'この事件が解決編になったとき、自分は手札を1枚リムーブする。',
  ruleRefs: [
    'rules/01-victory-conditions.md',
    'rules/15-abilities-effects.md'
  ]
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'declared',
  scope: 'always',
  condition: { kind: 'caseStatus', status: '解決編' },
  limit: { kind: 'turn', n: 1 },
  cost: { kind: 'flipFaceUpEvidence', n: { min: 1, max: 1 } },
  effect: {
    kind: 'atom',
    verb: 'toPartnerArea',
    args: {
      player: 'self',
      max: 1,
      filter: { trait: 'ビッグジュエル' }
    }
  },
  description: '【解決編】【宣言】【ターン1】〚裏向きの証拠を1つ表向きにする〛：自分のリムーブエリアにある〚特徴［ビッグジュエル］〛のカードを1枚まで選び、パートナーエリアに移す。',
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md'
  ]
};

export const B07061: CardDef = {
  id: 'B07061',
  no: '0790/B07061',
  kind: 'case',
  names: [
    '日輪の後光の巻'
  ],
  colors: [
    '白'
  ],
  traits: [],
  rarity: 'C',
  imageUrl: '1762414010623860.jpg',
  caseLevel: 7,
  caseTraits: [],
  abilities: [a1, a2],
  ruleRefs: [
    'rules/01-victory-conditions.md',
    'rules/03-field-areas.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md'
  ],
};
