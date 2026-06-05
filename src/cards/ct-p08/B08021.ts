// cards/ct-p08/B08021 服部平次 (キャラ) — catalog-reuse batch
// rules: 10-action-event.md, 13-keywords.md, 15-abilities-effects.md, 17-icons.md, 19-special-rules.md
//
// 公式テキスト:
//   〚突撃〛（登場したターンからすぐにアクションできる）
//   【絆遠山和葉】【自分ターン中】AP＋2000
//   【ヒラメキ】（証拠からリムーブされるときに発動する）自分のリムーブエリアにある〚カード名［遠山和葉］〛を1枚まで選び、手札に加える。
//
// a1: 【絆遠山和葉】【自分ターン中】AP＋2000 — continuous and(bond:[遠山和葉], turn:self) + apDelta:2000 (D09006 a1 同型)。
// a2: 【ヒラメキ】リムーブの[遠山和葉]を1枚まで選び、手札に加える (D08013 a2 / D11012 a2 同型)。
//     〚突撃〛は無条件キーワード → keywords:['突撃']。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'continuous',
  scope: 'on-scene',
  // 【絆遠山和葉】かつ【自分ターン中】
  condition: { kind: 'and', cs: [{ kind: 'bond', cardName: '遠山和葉' }, { kind: 'turn', player: 'self' }] },
  // AP＋2000
  continuousModifier: { apDelta: 2000 },
  description: '【絆遠山和葉】【自分ターン中】AP＋2000',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-evidence',
  trigger: { hook: 'evidence:remove-by-action', optional: true }, // 任意発動
  // 自分のリムーブエリアにある[遠山和葉]を1枚まで選び、手札に加える
  effect: { kind: 'atom', verb: 'handAddFromRemove', args: { player: 'self', max: 1, filter: { cardName: '遠山和葉' } } },
  description: '【ヒラメキ】リムーブの[遠山和葉]を1枚まで選び、手札に加える。',
  ruleRefs: ['rules/10-action-event.md', 'rules/19-special-rules.md'],
};

export const B08021: CardDef = {
  id: 'B08021',
  no: '0861/B08021',
  kind: 'character',
  names: ['服部平次'],
  colors: ['緑'],
  level: 7,
  ap: 6000,
  lp: 1,
  traits: ['探偵', '高校生'],
  keywords: ['突撃'],
  rarity: 'R',
  imageUrl: '1770731204436409.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/10-action-event.md',
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/19-special-rules.md',
  ],
};
