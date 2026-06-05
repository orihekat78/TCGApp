// cards/ct-p09/B09006 毛利小五郎 (キャラ) — catalog-reuse batch
// rules: 03-field-areas.md, 13-keywords.md, 15-abilities-effects.md, 17-icons.md, 21-declared-ability-cost.md
//
// 公式テキスト:
//   【絆妃英理】【宣言】【ターン1】AP8000以下のスリープ状態のキャラを1枚まで選び、リムーブする。自分の現場にいる〚カード名［妃英理］〛を1枚まで選び、アクティブにする。
//
// a1: 宣言能力【ターン1】(条件 絆妃英理) — sequence: AP8000以下スリープを1枚までリムーブ → 現場の[妃英理]を1枚までアクティブ化
import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'declared',
  scope: 'on-scene',
  // 【絆妃英理】
  condition: { kind: 'bond', cardName: '妃英理' },
  limit: { kind: 'turn', n: 1 },
  effect: {
    kind: 'sequence',
    steps: [
      // AP8000以下のスリープ状態のキャラを1枚まで選び、リムーブする。
      { kind: 'atom', verb: 'sceneRemove', args: { player: 'self', max: 1, side: 'either', filter: { apMax: 8000 }, state: ['sleep'] } },
      // 自分の現場にいる[妃英理]を1枚まで選び、アクティブにする。
      { kind: 'atom', verb: 'sceneSetState', args: { uid: '$pick', state: 'active', target: { kind: 'pick', query: { area: 'scene', side: 'self', filter: { cardName: '妃英理' } }, n: { min: 0, max: 1 }, chooser: 'self' } } },
    ],
  },
  description: '【絆妃英理】【宣言】【ターン1】AP8000以下スリープを1枚までリムーブし、現場の[妃英理]を1枚までアクティブにする。',
  ruleRefs: ['rules/03-field-areas.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/21-declared-ability-cost.md'],
};

export const B09006: CardDef = {
  id: 'B09006',
  no: '0951/B09006',
  kind: 'character',
  names: ['毛利小五郎'],
  colors: ['青'],
  level: 8,
  ap: 8000,
  lp: 0,
  traits: ['探偵', '毛利探偵事務所'],
  keywords: [],
  rarity: 'R',
  imageUrl: '1775608802607850.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/21-declared-ability-cost.md',
  ],
};
