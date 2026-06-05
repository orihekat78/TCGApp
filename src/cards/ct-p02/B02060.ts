// cards/ct-p02/B02060 ジョディ・スターリング (キャラ) — catalog-reuse batch
// rules: 11-reasoning.md, 13-keywords.md, 15-abilities-effects.md, 17-icons.md
//
// 公式テキスト:
//   〚ミスリード1〛（相手の推理に対し、スリープさせることでLP－1する）
//   【登場時】キャラを1枚まで選び、ターン終了時までAP－1000する。
//
// a1: 〚ミスリード1〛 — misreadX(1) 共通クラス (reasoning:before-add 経由)
// a2: 【登場時】 enter hook → キャラを1枚まで選び AP-1000 (turn scope)
//     uid:'$pick' + 明示 target:{kind:'pick'} 形 (D08026 a2 / B09085 a1 同型、charModifyAP 版)

import type { AbilityDef, CardDef } from '@/engine/types';
import { misreadX } from '@/cards/_shared';

// a2: 【登場時】キャラを1枚まで選び、ターン終了時までAP－1000する。
const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'enter', selfOnly: true },
  effect: {
    kind: 'atom',
    verb: 'charModifyAP',
    // キャラを1枚まで選び、ターン終了時までAP－1000する
    args: {
      uid: '$pick',
      delta: -1000,
      scope: 'turn',
      target: {
        kind: 'pick',
        query: { area: 'scene', side: 'either' },
        n: { min: 0, max: 1 },
        chooser: 'self',
      },
    },
  },
  description: '【登場時】キャラを1枚まで選び、ターン終了時までAP－1000する。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

export const B02060: CardDef = {
  id: 'B02060',
  no: '0223/B02060',
  kind: 'character',
  names: ['ジョディ・スターリング'],
  colors: ['赤'],
  level: 4,
  ap: 4000,
  lp: 1,
  traits: ['FBI'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1721357250101538.jpg',
  abilities: [misreadX({ x: 1, abilityId: 'a1' }), a2],
  ruleRefs: [
    'rules/11-reasoning.md',
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
  ],
};
