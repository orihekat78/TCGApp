// cards/ct-p02/B02009 小林澄子 (キャラ) — catalog-reuse batch
// rules: 10-action-event.md, 14-refresh.md, 15-abilities-effects.md, 17-icons.md, 19-special-rules.md
//
// 公式テキスト:
//   【登場時】〚特徴［少年探偵団］〛のキャラを1枚まで選び、ターン終了時までAP＋1000する。
//   【ヒラメキ】（証拠からリムーブされるときに発動する）自分のリムーブエリアにある〚特徴［少年探偵団］〛のキャラを1枚まで選び、手札に加える。
//
// a1: 【登場時】(enter selfOnly) → 少年探偵団 を1枚まで選び AP＋1000 (ターン終了まで) — D11015 a1 同型 PA 短縮形
// a2: 【ヒラメキ】(evidence:remove-by-action optional) → リムーブの 少年探偵団 を1枚まで手札へ — D11012 a2 同型 handAddFromRemove

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'enter', selfOnly: true },
  // 〚特徴［少年探偵団］〛のキャラを1枚まで選び、ターン終了時までAP＋1000する
  effect: { kind: 'atom', verb: 'charModifyAP', args: { delta: 1000, max: 1, side: 'either', filter: { trait: '少年探偵団' }, scope: 'turn' } },
  description: '【登場時】[少年探偵団]のキャラを1枚まで選び、ターン終了時までAP＋1000。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-evidence',
  trigger: { hook: 'evidence:remove-by-action', optional: true },
  // 自分のリムーブエリアにある[少年探偵団]のキャラを1枚まで選び、手札に加える
  effect: { kind: 'atom', verb: 'handAddFromRemove', args: { player: 'self', max: 1, filter: { kind: 'character', trait: '少年探偵団' } } },
  description: '【ヒラメキ】リムーブの[少年探偵団]を1枚まで選び、手札に加える。',
  ruleRefs: ['rules/10-action-event.md', 'rules/14-refresh.md', 'rules/19-special-rules.md'],
};

export const B02009: CardDef = {
  id: 'B02009',
  no: '0181/B02009',
  kind: 'character',
  names: ['小林澄子'],
  colors: ['青'],
  level: 4,
  ap: 4000,
  lp: 1,
  traits: ['教師'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1721357158848036.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/10-action-event.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/19-special-rules.md',
  ],
};
