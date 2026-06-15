// cards/ct-p09/B09009 赤木守 (キャラ) — engine拡張 wave#2 cluster13 (aura-grant, 2026-06-15)
// rules: 15-abilities-effects.md, 17-icons.md, 24-qa-naming-stun.md, 10-action-event.md, 14-refresh.md
//
// 公式テキスト: 【自分ターン中】自分の現場にいる〚特徴［サッカー選手］〛のキャラをAP＋1000する。【ヒラメキ】自分のリムーブエリアにある〚特徴［サッカー選手］〛のキャラを1枚まで選び、手札に加える。
//
// 句マッピング:
//   - 【自分ターン中】自分の現場にいる〚特徴［サッカー選手］〛のキャラをAP＋1000する => type:'continuous' + condition{turn:self} +
//     continuousModifier{apDeltaAura:1000, auraFilter, auraExcludeSelf?}。board-scan reader (read.char.auraDelta) が
//     bearer の同一 side 現場の各キャラに auraFilter (matchOneFilter=有効値) 一致時 +1000 (rules/24 §常時有効型)。
//   - ※「このキャラ以外」の記載なし = include-self (赤木守 は特徴[サッカー選手]を持たないため対象外、include は無害)。
//   - 【ヒラメキ】リムーブエリアの〚特徴サッカー選手〛を1枚まで手札に => a2 evidence:remove-by-action optional +
//     handAddFromRemove{filter:{trait:サッカー選手, kind:character}, max:1} (0枚可 = 「1枚まで」, D01012 a2 hirameki-pick 同経路)。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'continuous',
  scope: 'on-scene',
  condition: { kind: 'turn', player: 'self' },
  continuousModifier: { apDeltaAura: 1000, auraFilter: { trait: 'サッカー選手', kind: 'character' } },
  description: '【自分ターン中】自分の現場にいる〚特徴［サッカー選手］〛のキャラをAP＋1000する。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/24-qa-naming-stun.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-evidence',
  trigger: { hook: 'evidence:remove-by-action', optional: true },
  effect: { kind: 'atom', verb: 'handAddFromRemove', args: { player: 'self', max: 1, filter: { trait: 'サッカー選手', kind: 'character' } } },
  description: '【ヒラメキ】（証拠からリムーブされるときに発動する）自分のリムーブエリアにある〚特徴［サッカー選手］〛のキャラを1枚まで選び、手札に加える。',
  ruleRefs: ['rules/10-action-event.md', 'rules/14-refresh.md', 'rules/17-icons.md'],
};

export const B09009: CardDef = {
  id: 'B09009',
  no: '0954/B09009',
  kind: 'character',
  names: ['赤木守'],
  colors: ['青'],
  level: 2,
  ap: 1000,
  lp: 0,
  traits: [],
  keywords: [],
  rarity: 'C',
  imageUrl: '1775608802648489.jpg',
  abilities: [a1, a2],
  ruleRefs: ['rules/10-action-event.md', 'rules/14-refresh.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/24-qa-naming-stun.md'],
};
