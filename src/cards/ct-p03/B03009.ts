// cards/ct-p03/B03009 栗山緑 (キャラ) — catalog-reuse batch
// rules: 03-field-areas.md, 13-keywords.md, 15-abilities-effects.md, 17-icons.md
//
// 公式テキスト:
//   〚ミスリード1〛（相手の推理に対し、スリープさせることでLP－1する）
//   【登場時】相手の現場にスリープ状態かスタン状態のキャラが合わせて3枚以上いる場合、カードを1枚引く。
//
// a1: 〚ミスリード1〛 — misreadX 共通 (icon-misread)
// a2: 【登場時】相手現場の sleep|stun が3枚以上なら1ドロー (D08003 a2 同型 conditional + sceneHas)

import type { AbilityDef, CardDef } from '@/engine/types';
import { misreadX } from '@/cards/_shared';

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-scene',
  // 【登場時】
  trigger: { hook: 'enter', selfOnly: true },
  effect: {
    kind: 'conditional',
    // 相手の現場にスリープ状態かスタン状態のキャラが合わせて3枚以上いる場合
    if: { kind: 'sceneHas', query: { area: 'scene', side: 'opp', state: ['sleep', 'stun'] }, nMin: 3 },
    // カードを1枚引く
    then: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
  },
  description: '【登場時】相手の現場にスリープ/スタンが3枚以上いる場合、カードを1枚引く。',
  ruleRefs: ['rules/03-field-areas.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

export const B03009: CardDef = {
  id: 'B03009',
  no: '0267/B03009',
  kind: 'character',
  names: ['栗山緑'],
  colors: ['青'],
  level: 4,
  ap: 4000,
  lp: 1,
  traits: ['秘書'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1729133048282281.jpg',
  abilities: [misreadX({ x: 1, abilityId: 'a1' }), a2],
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
  ],
};
