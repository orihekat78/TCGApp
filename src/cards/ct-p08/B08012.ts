// cards/ct-p08/B08012 比護隆佑 (キャラ) — engine拡張 wave#2 cluster3 (action-lifecycle trigger, 2026-06-14)
// rules: 07-action-flow.md, 10-action-event.md, 13-keywords.md, 14-refresh.md, 15-abilities-effects.md, 17-icons.md, 22-qa-action-contact.md, 24-qa-naming-stun.md
//
// 公式テキスト (ct-p08/character.tsv B08012):
//   【絆真田貴大】〚突撃［事件］〛（登場したターンからすぐに事件を指定してアクションできる）
//   このキャラのアクション［事件］によって証拠を得たとき、カードを1枚引く。
//
// 句マッピング:
//   a1 (常時有効): 【絆真田貴大】=> condition {kind:'bond', cardName:'真田貴大'} (rules/17 §【絆】= 自分の現場に
//       指定[カード名]のキャラがいる / パートナーでは不成立)。条件成立中のみ〚突撃［事件］〛を持つ
//       (常時有効型 = 発動するものでなく自動的に効果を持つ。条件外で即失効 / rules/24 §「〜の場合」型)。
//       => continuousModifier {grantKeywords: () => ['突撃[事件]']} (B09051 a1 / B04054 a1 同型)。
//       qAndA: アクション中に【絆】が無効化されてもアクションは継続 (rules/22:54, rules/24:40 アクション継続性) —
//       これは骨格のアクション進行で自然成立 (continuous は read 時評価、開始済アクションは中断しない)。
//   a2 (条件発動): 「このキャラのアクション［事件］によって証拠を得たとき、カードを1枚引く」=>
//       trigger {hook:'evidence:gain', selfOnly:true} (cluster3 X9/X10。evidence:gain は flow/action-case.ts
//       gainSelfEvidence の実獲得時のみ emit = 「アクション[事件]によって」を構造的に保証。推理/効果/refresh 由来では
//       発火しない)。selfOnly = source.uid(actor)=このキャラ uid 一致 = 「この」キャラ限定 (rules/10 手順3)。
//       => draw1 (必須 /「引く」= rules/15)。actor は action[事件] 宣言でスリープ化し現場に在場 → in-play scan 対象。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'continuous',
  scope: 'on-scene',
  // 【絆真田貴大】(自分の現場に[真田貴大]のキャラがいる間のみ有効 / rules/17)
  condition: { kind: 'bond', cardName: '真田貴大' },
  // 〚突撃［事件］〛（登場したターンからすぐに事件を指定してアクションできる）
  continuousModifier: { grantKeywords: () => ['突撃[事件]'] },
  description: '【絆真田貴大】〚突撃［事件］〛を持つ。',
  ruleRefs: ['rules/13-keywords.md', 'rules/17-icons.md', 'rules/24-qa-naming-stun.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-scene',
  // このキャラのアクション［事件］によって証拠を得たとき (実獲得時のみ emit / rules/10 手順3)
  trigger: { hook: 'evidence:gain', selfOnly: true },
  // カードを1枚引く
  effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
  description: 'このキャラのアクション［事件］によって証拠を得たとき、カードを1枚引く。',
  ruleRefs: ['rules/10-action-event.md', 'rules/14-refresh.md', 'rules/15-abilities-effects.md'],
};

export const B08012: CardDef = {
  id: 'B08012',
  no: '0853/B08012',
  kind: 'character',
  names: ['比護隆佑'],
  colors: ['青'],
  level: 5,
  ap: 5000,
  lp: 0,
  traits: ['サッカー選手'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1770731204369543.jpg',
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