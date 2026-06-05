// cards/ct-p05/B05089 上原由衣 (キャラ) — catalog-reuse batch
// rules: 13-keywords.md, 15-abilities-effects.md, 17-icons.md
//
// 公式テキスト:
//   【事件編】【登場時】カードを1枚引く。
//   【解決編】【登場時】ターン終了時までこのキャラは〚突撃［キャラ］〛を持つ。
//
// a1: 事件編 enter → 1ドロー。a2: 解決編 enter → このキャラに突撃[キャラ] (ターン終了まで)。
//     caseStatus 条件ゲート (D08019 a1 同型) + enter selfOnly。charGrantKeyword($self) は D11015 a2 同型。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  // 【事件編】
  condition: { kind: 'caseStatus', status: '事件編' },
  // 【登場時】
  trigger: { hook: 'enter', selfOnly: true },
  effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
  description: '【事件編】【登場時】カードを1枚引く。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-scene',
  // 【解決編】
  condition: { kind: 'caseStatus', status: '解決編' },
  // 【登場時】
  trigger: { hook: 'enter', selfOnly: true },
  // ターン終了時までこのキャラは〚突撃［キャラ］〛を持つ
  effect: { kind: 'atom', verb: 'charGrantKeyword', args: { uid: '$self', kw: '突撃[キャラ]', scope: 'turn' } },
  description: '【解決編】【登場時】ターン終了時まで このキャラは突撃[キャラ]を持つ。',
  ruleRefs: ['rules/13-keywords.md', 'rules/17-icons.md'],
};

export const B05089: CardDef = {
  id: 'B05089',
  no: '0587/B05089',
  kind: 'character',
  names: ['上原由衣'],
  colors: ['黄'],
  level: 6,
  ap: 5000,
  lp: 1,
  traits: ['警察', '長野県警'],
  keywords: [],
  rarity: 'R',
  imageUrl: '1743742488549073.jpg',
  abilities: [a1, a2],
  ruleRefs: ['rules/13-keywords.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md'],
};
