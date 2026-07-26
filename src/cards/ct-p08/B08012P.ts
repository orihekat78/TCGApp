// cards/ct-p08/B08012P 比護隆佑 (キャラ・パラレル) — engine拡張 wave#2 cluster3 (action-lifecycle triggers, 2026-06-14)
// rules: 13-keywords.md, 15-abilities-effects.md, 17-icons.md, 22-qa-action-contact.md, 24-qa-naming-stun.md
//
// 公式テキスト (B08012 と同一効果。P 版は cardNum / rarity / imageUrl のみ異なる — TSV 全文比較で effect/cutIn/hirameki 完全一致):
//   effect:
//     【絆真田貴大】〚突撃［事件］〛（登場したターンからすぐに事件を指定してアクションできる）
//     このキャラのアクション［事件］によって証拠を得たとき、カードを1枚引く。
//
// 句マッピング (B08012 と同一 — 同テキスト別ファイル full def 慣行 / B08005P・B08029P 同様):
//   a1: 【絆真田貴大】〚突撃［事件］〛 => 常時有効 (continuous, scope:'on-scene')。
//       condition: {kind:'bond', cardName:'真田貴大'} (rules/17 【絆】= 自分の現場に指定カード名のキャラがいる間のみ有効)、
//       条件成立中は〚突撃[事件]〛を持つ => continuousModifier.grantKeywords (B09051 a1 同型、bond + grantKeywords)。
//       条件が途中で失われても進行中のアクションは継続 (rules/22, qAndA 裁定。常時有効の自動失効は engine 側で評価)。
//   a2: 「このキャラのアクション［事件］によって証拠を得たとき、カードを1枚引く」=> type:'triggered'。
//       trigger{hook:'evidence:gain', selfOnly:true} (cluster3 新 hook X9/X10 — このキャラのアクション[事件]で証拠を
//       得たときのみ発動。selfOnly により他キャラ由来の獲得・推理/効果由来では発動しない / rules/15)、
//       effect: draw1 (必須 / rules/15「〜する」)。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'continuous',
  scope: 'on-scene',
  // 【絆真田貴大】 (条件不成立なら能力を持たない扱い / rules/17)
  condition: { kind: 'bond', cardName: '真田貴大' },
  // 〚突撃[事件]〛を持つ
  continuousModifier: { grantKeywords: () => ['突撃[事件]'], printedKeywordWhenIconValid: true },
  description: '【絆真田貴大】〚突撃［事件］〛を持つ。',
  ruleRefs: ['rules/13-keywords.md', 'rules/17-icons.md', 'rules/24-qa-naming-stun.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-scene',
  // このキャラのアクション［事件］によって証拠を得たとき (cluster3 evidence:gain hook / selfOnly)
  trigger: { hook: 'evidence:gain', selfOnly: true },
  // カードを1枚引く (必須)
  effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
  description: 'このキャラのアクション［事件］によって証拠を得たとき、カードを1枚引く。',
  ruleRefs: ['rules/10-action-event.md', 'rules/14-refresh.md', 'rules/15-abilities-effects.md'],
};

export const B08012P: CardDef = {
  id: 'B08012P',
  no: '0853/B08012P',
  kind: 'character',
  names: ['比護隆佑'],
  colors: ['青'],
  level: 5,
  ap: 5000,
  lp: 0,
  traits: ['サッカー選手'],
  keywords: [],
  rarity: 'CP',
  imageUrl: '1770878966382169.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/07-action-flow.md',
    'rules/10-action-event.md',
    'rules/13-keywords.md',
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/22-qa-action-contact.md',
    'rules/24-qa-naming-stun.md',
  ],
};
