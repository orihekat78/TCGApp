// cards/pr-01/PR059 毛利小五郎 (キャラ) — catalog-reuse batch
// rules: 03-field-areas.md, 15-abilities-effects.md, 17-icons.md
//
// 公式テキスト:
//   【解決編】【登場時】キャラを1枚まで選び、スリープさせる。（自分の事件が解決編になっている場合、この能力か効果を使える）
//
// a1: 【解決編】(condition caseStatus) 【登場時】(enter selfOnly) → キャラを1枚まで選びスリープ — D08019 a1 同型 (条件付き登場時 + sceneSetState 短縮形)

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  // 【解決編】自分の事件が解決編になっている場合に使える
  condition: { kind: 'caseStatus', status: '解決編' },
  // 【登場時】
  trigger: { hook: 'enter', selfOnly: true },
  // キャラを1枚まで選び、スリープさせる
  effect: { kind: 'atom', verb: 'sceneSetState', args: { player: 'self', max: 1, side: 'either', state: 'sleep' } },
  description: '【解決編】【登場時】キャラを1枚まで選び、スリープさせる。',
  ruleRefs: ['rules/03-field-areas.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

export const PR059: CardDef = {
  id: 'PR059',
  no: '0403/PR059',
  kind: 'character',
  names: ['毛利小五郎'],
  colors: ['青'],
  level: 5,
  ap: 6000,
  lp: 0,
  traits: ['探偵', '毛利探偵事務所'],
  keywords: [],
  rarity: 'PR',
  imageUrl: '1732542002095067.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
  ],
};
