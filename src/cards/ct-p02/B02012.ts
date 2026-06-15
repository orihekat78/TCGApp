// cards/ct-p02/B02012 毛利小五郎 (キャラ) — engine拡張 wave#2 cluster13 (aura-grant, 2026-06-15)
// rules: 15-abilities-effects.md, 17-icons.md, 24-qa-naming-stun.md, 22-qa-action-contact.md
//
// 公式テキスト: 【自分ターン中】自分の現場にいるレベル5以下の【青】のキャラをAP＋1000する。【ターン1】自分の現場にいる〚カード名［妃英理］〛か〚特徴［毛利探偵事務所］〛のキャラがアクションしたとき、カードを1枚引く。
//
// 句マッピング:
//   - 【自分ターン中】自分の現場にいるレベル5以下の【青】のキャラをAP＋1000する => type:'continuous' + condition{turn:self} +
//     continuousModifier{apDeltaAura:1000, auraFilter, auraExcludeSelf?}。board-scan reader (read.char.auraDelta) が
//     bearer の同一 side 現場の各キャラに auraFilter (matchOneFilter=有効値) 一致時 +1000 (rules/24 §常時有効型)。
//   - ※「このキャラ以外」の記載なし = include-self (毛利小五郎 自身は Lv7 のため levelMax:5 で対象外、include は無害)。
//   - 【ターン1】〚カード名妃英理〛か〚特徴毛利探偵事務所〛のキャラがアクションしたとき1ドロー =>
//     a2 triggered action:declare + limit{turn,1} + or[triggerCharMatches{cardName:妃英理}, triggerCharMatches{trait:毛利探偵事務所}] + draw。
//     アクション宣言時 (ガード前) 発動 (rules/22)。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'continuous',
  scope: 'on-scene',
  condition: { kind: 'turn', player: 'self' },
  continuousModifier: { apDeltaAura: 1000, auraFilter: { color: '青', kind: 'character', levelMax: 5 } },
  description: '【自分ターン中】自分の現場にいるレベル5以下の【青】のキャラをAP＋1000する。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/24-qa-naming-stun.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'action:declare' },
  limit: { kind: 'turn', n: 1 },
  condition: { kind: 'or', cs: [
    { kind: 'triggerCharMatches', side: 'self', filter: { cardName: '妃英理' } },
    { kind: 'triggerCharMatches', side: 'self', filter: { trait: '毛利探偵事務所' } },
  ] },
  effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
  description: '【ターン1】自分の現場にいる〚カード名［妃英理］〛か〚特徴［毛利探偵事務所］〛のキャラがアクションしたとき、カードを1枚引く。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/22-qa-action-contact.md'],
};

export const B02012: CardDef = {
  id: 'B02012',
  no: '0184/B02012',
  kind: 'character',
  names: ['毛利小五郎'],
  colors: ['青'],
  level: 7,
  ap: 6000,
  lp: 0,
  traits: ['探偵', '毛利探偵事務所'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1721357158862925.jpg',
  abilities: [a1, a2],
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/22-qa-action-contact.md'],
};
