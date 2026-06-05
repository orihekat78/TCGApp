// cards/ct-p09/B09029 新名香保里 (キャラ) — catalog-reuse batch
// rules: 10-action-event.md, 14-refresh.md, 15-abilities-effects.md, 17-icons.md, 19-special-rules.md
//
// 公式テキスト:
//   【登場時】自分のリムーブエリアにある〚特徴［探偵］〛のキャラを1枚まで選び、手札に加える。
//   【ヒラメキ】（証拠からリムーブされるときに発動する）自分のリムーブエリアにある〚特徴［探偵］〛のキャラを1枚まで選び、手札に加える。
//
// a1: 【登場時】 リムーブの[探偵]を1枚まで手札に加える (handAddFromRemove / B05055 a2 同型)。
// a2: 【ヒラメキ】 リムーブの[探偵]を1枚まで手札に加える (handAddFromRemove / B09088 a2 同型)。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'enter', selfOnly: true },
  // 自分のリムーブエリアにある[探偵]のキャラを1枚まで選び、手札に加える
  effect: { kind: 'atom', verb: 'handAddFromRemove', args: { player: 'self', max: 1, filter: { trait: '探偵' } } },
  description: '【登場時】自分のリムーブエリアにある[探偵]のキャラを1枚まで選び、手札に加える。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/19-special-rules.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-evidence',
  trigger: { hook: 'evidence:remove-by-action', optional: true }, // 任意発動
  // 自分のリムーブエリアにある[探偵]のキャラを1枚まで選び、手札に加える
  effect: { kind: 'atom', verb: 'handAddFromRemove', args: { player: 'self', max: 1, filter: { trait: '探偵' } } },
  description: '【ヒラメキ】自分のリムーブエリアにある[探偵]のキャラを1枚まで選び、手札に加える。',
  ruleRefs: ['rules/10-action-event.md', 'rules/14-refresh.md', 'rules/19-special-rules.md'],
};

export const B09029: CardDef = {
  id: 'B09029',
  no: '0973/B09029',
  kind: 'character',
  names: ['新名香保里'],
  colors: ['緑'],
  level: 4,
  ap: 3000,
  lp: 1,
  traits: ['小説家'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1775608835805945.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/10-action-event.md',
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/19-special-rules.md',
  ],
};
