// cards/ct-p08/B08010 真田貴大 (character) — engine拡張 wave#2 cluster15 follow-up (removal-observer + bond keyword grant, 2026-06-18)
// rules: 07-action-flow.md, 08-contact.md, 13-keywords.md, 15-abilities-effects.md,
//        17-icons.md, 22-qa-action-contact.md, 24-qa-naming-stun.md
//
// 公式テキスト (ct-p08/character.tsv B08010):
//   【絆比護隆佑】〚突撃［キャラ］〛（登場したターンからすぐにキャラを指定してアクションできる）
//   相手の現場にいるキャラがこのキャラとのコンタクトによってリムーブされたとき、カードを1枚引く。
//
// B08012 比護隆佑 と相互参照のペアカード (絆 比護隆佑 ↔ 絆 真田貴大)。a1 構造は B08012 a1 の鏡像。
// 句マッピング:
//   a1 (常時有効): 【絆比護隆佑】= condition {kind:'bond', cardName:'比護隆佑'} (自分の現場に[比護隆佑]がいる間のみ有効 /
//       rules/17、パートナーでは不成立、分割名対応)。条件成立中のみ〚突撃［キャラ］〛を持つ (常時有効型 / rules/24)。
//       continuousModifier {grantKeywords: () => ['突撃[キャラ]']} (closure・JSON 不能 / B08012 a1・B09051 a1 同型)。
//       括弧書きは突撃[キャラ]の rules リマインダ文で別効果なし。qAndA: アクション中に絆無効化されてもアクション継続 (rules/22)。
//   a2 (条件発動): removal-observer (cluster15)。trigger {hook:'leave:to-remove'} (selfOnly 無)
//       + condition removedCharMatches{side:'opp',cause:'contact-ap',by:'self'}。effect = draw1 (removal verb 非含 → cascade 無)。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'continuous',
  scope: 'on-scene',
  // 【絆比護隆佑】(自分の現場に[比護隆佑]のキャラがいる間のみ有効 / rules/17)
  condition: { kind: 'bond', cardName: '比護隆佑' },
  // 〚突撃［キャラ］〛（登場したターンからすぐにキャラを指定してアクションできる）
  continuousModifier: { grantKeywords: () => ['突撃[キャラ]'], printedKeywordWhenIconValid: true },
  description: '【絆比護隆佑】〚突撃［キャラ］〛を持つ。',
  ruleRefs: ['rules/13-keywords.md', 'rules/17-icons.md', 'rules/24-qa-naming-stun.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-scene',
  // 相手の現場にいるキャラがこのキャラとのコンタクトによってリムーブされたとき
  trigger: { hook: 'leave:to-remove' },
  condition: { kind: 'removedCharMatches', side: 'opp', cause: 'contact-ap', by: 'self' },
  // カードを1枚引く
  effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
  description:
    '相手の現場にいるキャラがこのキャラとのコンタクトによってリムーブされたとき、カードを1枚引く。',
  ruleRefs: [
    'rules/07-action-flow.md',
    'rules/08-contact.md',
    'rules/15-abilities-effects.md',
    'rules/22-qa-action-contact.md',
  ],
};

export const B08010: CardDef = {
  id: 'B08010',
  no: '0851/B08010',
  kind: 'character',
  names: ['真田貴大'],
  colors: ['青'],
  level: 4,
  ap: 4000,
  lp: 0,
  traits: ['サッカー選手'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1770731204355761.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/07-action-flow.md',
    'rules/08-contact.md',
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/22-qa-action-contact.md',
    'rules/24-qa-naming-stun.md',
  ],
};
