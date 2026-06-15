// cards/ct-p01/B01038 服部平蔵 (キャラ) — engine拡張 wave#2 cluster13 (aura-grant, 2026-06-15)
// rules: 15-abilities-effects.md, 17-icons.md, 24-qa-naming-stun.md, 10-action-event.md, 14-refresh.md
//
// 公式テキスト: 【自分ターン中】自分の現場にいるこのキャラ以外の【緑】のキャラをAP＋1000する。
//
// 句マッピング:
//   - 【自分ターン中】自分の現場にいるこのキャラ以外の【緑】のキャラをAP＋1000する => type:'continuous' + condition{turn:self} +
//     continuousModifier{apDeltaAura:1000, auraFilter, auraExcludeSelf?}。board-scan reader (read.char.auraDelta) が
//     bearer の同一 side 現場の各キャラに auraFilter (matchOneFilter=有効値) 一致時 +1000 (rules/24 §常時有効型)。
//   - 【ヒラメキ】カードを1枚引く => a2 evidence:remove-by-action optional draw 1。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'continuous',
  scope: 'on-scene',
  condition: { kind: 'turn', player: 'self' },
  continuousModifier: { apDeltaAura: 1000, auraFilter: { color: '緑', kind: 'character' }, auraExcludeSelf: true },
  description: '【自分ターン中】自分の現場にいるこのキャラ以外の【緑】のキャラをAP＋1000する。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/24-qa-naming-stun.md'],
};

// a2: 【ヒラメキ】カードを1枚引く (D01013 a2 同型, rules/10)
const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-evidence',
  trigger: { hook: 'evidence:remove-by-action', optional: true },
  effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
  description: '【ヒラメキ】（証拠からリムーブされるときに発動する）カードを1枚引く。',
  ruleRefs: ['rules/10-action-event.md', 'rules/14-refresh.md'],
};

export const B01038: CardDef = {
  id: 'B01038',
  no: '0032/B01038',
  kind: 'character',
  names: ['服部平蔵'],
  colors: ['緑'],
  level: 6,
  ap: 6000,
  lp: 1,
  traits: ['警察', '大阪府警'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1714013001025790.jpg',
  abilities: [a1, a2],
  ruleRefs: ['rules/10-action-event.md', 'rules/14-refresh.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/24-qa-naming-stun.md'],
};
