// cards/ct-p03/B03004 江戸川コナン (キャラ) — catalog-reuse batch
// rules: 03-field-areas.md, 10-action-event.md, 14-refresh.md, 15-abilities-effects.md, 17-icons.md, 19-special-rules.md
//
// 公式テキスト:
//   【解決編】【登場時】手札を1枚リムーブしてもよい。そうした場合、自分の現場にいるLP0の〚カード名［毛利蘭］〛を1枚まで選び、アクティブにする。
//   【ヒラメキ】（証拠からリムーブされるときに発動する）自分のリムーブエリアにある〚カード名［工藤新一］〛を1枚まで選び、手札に加える。
//
// a1: 【解決編】【登場時】chain — 手札1リム (max:1) → LP0[毛利蘭]を1枚までアクティブ化 (D08003 a1 同型 chain)
// a2: 【ヒラメキ】リムーブの[工藤新一]を1枚まで選び、手札に加える (D11012 a2 同型 handAddFromRemove)

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  // 【解決編】
  condition: { kind: 'caseStatus', status: '解決編' },
  // 【登場時】
  trigger: { hook: 'enter', selfOnly: true },
  effect: {
    kind: 'chain',
    steps: [
      // 手札を1枚リムーブしてもよい
      { kind: 'atom', verb: 'discard', args: { player: 'self', max: 1 } },
      // そうした場合、自分の現場にいるLP0の[毛利蘭]を1枚まで選び、アクティブにする (step1 適用時のみ)
      // LP0 = 有効LP がちょうど0 (rules/19: LP は ±修正で負にもなりうるため lpMin:0+lpMax:0 で厳密一致)。
      { kind: 'atom', verb: 'sceneSetState', args: { player: 'self', max: 1, side: 'self', state: 'active', filter: { cardName: '毛利蘭', lpMin: 0, lpMax: 0 } } },
    ],
  },
  description:
    '【解決編】【登場時】手札を1枚リムーブしてもよい。そうした場合、LP0の[毛利蘭]を1枚までアクティブにする。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/19-special-rules.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-evidence',
  trigger: { hook: 'evidence:remove-by-action', optional: true }, // 任意発動
  // 【ヒラメキ】自分のリムーブエリアにある[工藤新一]を1枚まで選び、手札に加える。
  effect: { kind: 'atom', verb: 'handAddFromRemove', args: { player: 'self', max: 1, filter: { cardName: '工藤新一' } } },
  description: '【ヒラメキ】リムーブの[工藤新一]を1枚まで選び、手札に加える。',
  ruleRefs: ['rules/10-action-event.md', 'rules/14-refresh.md', 'rules/19-special-rules.md'],
};

export const B03004: CardDef = {
  id: 'B03004',
  no: '0262/B03004',
  kind: 'character',
  names: ['江戸川コナン'],
  colors: ['青'],
  level: 5,
  ap: 5000,
  lp: 1,
  traits: ['探偵', '毛利探偵事務所', '少年探偵団'],
  keywords: [],
  rarity: 'R',
  imageUrl: '1729133048249954.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/10-action-event.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/19-special-rules.md',
  ],
};
