// cards/ct-p03/B03052 シャロン・ヴィンヤード (character) — engine mega-wave W3 exemplar (r10, 2026-07-03)
// rules: 09-cutin-disguise.md, 10-action-event.md, 15-abilities-effects.md, 19-special-rules.md, 23-qa-disguise-cutin.md
//
// 公式テキスト:
//   〚カード名［ベルモット］〛が【変装】によってこのキャラと入れ替わったとき、キャラを1枚まで選び、スリープさせる。
//   【ヒラメキ】（証拠からリムーブされるときに発動する）カードを1枚引く。
//
// 句マッピング:
//   a1: 「〚カード名［ベルモット］〛が【変装】によってこのキャラと入れ替わったとき」
//       => trigger{hook:'disguise:replaced', selfOnly:true (=このキャラと),
//          matcherCondition:{kind:'disguiseReplacedByMatches', filter:{cardName:'ベルモット'}}} (W3 新 primitive)。
//       被置換側 (退場した元キャラ自身) の反応 — emit は flow/contact.disguise、退場カードは既にデッキ下
//       のため virtual-location handler (handleDisguiseReplacedSelf) が def を直接走査する。
//       入替わり側の名 (newCardId) は rules/19 分割名展開で照合 (「ベルモット&シャロン」等も該当)。
//       公式Q&A「入れ替わったベルモットの【変装時】能力とどちらが先か → プレイヤーが好きな順番で解決」=
//       両効果とも pendingEffects に queue → 所有者任意順 (rules/15/25) で自動整合。
//   「キャラを1枚まで選び、スリープさせる」=> sceneSetState 短縮形 {player:'self', max:1, side:'either',
//       state:'sleep'} (「キャラ」無修飾 = どちらの現場も rules/15、「まで」= 0枚可)。
//   a2: 【ヒラメキ】カードを1枚引く => trigger{hook:'evidence:remove-by-action', optional:true} + draw
//       (D01003 byte 同型 clone)。
import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: {
    hook: 'disguise:replaced',
    selfOnly: true,
    matcherCondition: { kind: 'disguiseReplacedByMatches', filter: { cardName: 'ベルモット' } },
  },
  effect: { kind: 'atom', verb: 'sceneSetState', args: { player: 'self', max: 1, side: 'either', state: 'sleep' } },
  description: '〚カード名［ベルモット］〛が【変装】によってこのキャラと入れ替わったとき、キャラを1枚まで選び、スリープさせる。',
  ruleRefs: ['rules/09-cutin-disguise.md', 'rules/15-abilities-effects.md', 'rules/19-special-rules.md', 'rules/23-qa-disguise-cutin.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-evidence',
  trigger: { hook: 'evidence:remove-by-action', optional: true },
  effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
  description: '【ヒラメキ】（証拠からリムーブされるときに発動する）カードを1枚引く。',
  ruleRefs: ['rules/10-action-event.md'],
};

export const B03052: CardDef = {
  id: 'B03052',
  no: '0307/B03052',
  kind: 'character',
  names: ['シャロン・ヴィンヤード'],
  colors: ['白'],
  level: 3,
  ap: 3000,
  lp: 1,
  traits: ['女優'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1729133385805594.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/09-cutin-disguise.md',
    'rules/10-action-event.md',
    'rules/15-abilities-effects.md',
    'rules/19-special-rules.md',
    'rules/23-qa-disguise-cutin.md',
  ],
};
