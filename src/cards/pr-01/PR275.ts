// cards/pr-01/PR275 工藤新一 (キャラ) — engine拡張 wave#2 cluster13 (aura-grant, 2026-06-15)
// rules: 15-abilities-effects.md, 17-icons.md, 24-qa-naming-stun.md, 20-color-and-switch.md, 21-declared-ability-cost.md
//
// 公式テキスト: 【自分ターン中】自分の事件が【青】以外の色を持つ場合、自分の現場にいるこのキャラ以外のキャラをAP＋1000する。【宣言】【スリープ】：レベル9以下のキャラを1枚まで選び、リムーブする。
//
// 句マッピング:
//   - 【自分ターン中】自分の現場にいる【青】以外の色を持つ事件のときこのキャラ以外のキャラをAP＋1000する => type:'continuous' + condition{turn:self} +
//     continuousModifier{apDeltaAura:1000, auraFilter, auraExcludeSelf?}。board-scan reader (read.char.auraDelta) が
//     bearer の同一 side 現場の各キャラに auraFilter (matchOneFilter=有効値) 一致時 +1000 (rules/24 §常時有効型)。
//   - 条件「自分の事件が【青】以外の色を持つ場合」=> caseColor{color:[赤,緑,黄,黒,白]} (some=OR、青以外の色を1つでも持つ → true)。
//   - filter は色/特徴指定なし (このキャラ以外の全キャラ) => auraFilter{kind:'character'} + auraExcludeSelf:true。
//   - 【宣言】【スリープ】レベル9以下のキャラを1枚まで選びリムーブ => a2 declared cost{sleepSelf} +
//     sceneRemove{max:1, side:either, filter:{levelMax:9}} (D11005 a2 同型, rules/21)。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'continuous',
  scope: 'on-scene',
  condition: { kind: 'and', cs: [
    { kind: 'turn', player: 'self' },
    { kind: 'caseColor', color: ['赤', '緑', '黄', '黒', '白'] },
  ] },
  continuousModifier: { apDeltaAura: 1000, auraFilter: { kind: 'character' }, auraExcludeSelf: true },
  description: '【自分ターン中】自分の事件が【青】以外の色を持つ場合、自分の現場にいるこのキャラ以外のキャラをAP＋1000する。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/24-qa-naming-stun.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'declared',
  scope: 'on-scene',
  cost: { kind: 'sleepSelf' },
  effect: { kind: 'atom', verb: 'sceneRemove', args: { player: 'self', max: 1, side: 'either', cause: 'effect', filter: { levelMax: 9 } } },
  description: '【宣言】【スリープ】：レベル9以下のキャラを1枚まで選び、リムーブする。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/21-declared-ability-cost.md'],
};

export const PR275: CardDef = {
  id: 'PR275',
  no: '1057/PR275',
  kind: 'character',
  names: ['工藤新一'],
  colors: ['青'],
  level: 8,
  ap: 7000,
  lp: 2,
  traits: ['探偵', '高校生'],
  keywords: [],
  rarity: 'PR',
  imageUrl: '19e387bff5cc.jpg',
  abilities: [a1, a2],
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/20-color-and-switch.md', 'rules/21-declared-ability-cost.md'],
};
