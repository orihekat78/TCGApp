// cards/ct-d10/D10011 毛利小五郎 (character) — Task A certify-harvest needsManual (engine変更0, 手書き closure)
// rules: 09-cutin-disguise.md, 15-abilities-effects.md, 17-icons.md, 19-special-rules.md, 21-declared-ability-cost.md, 22-qa-action-contact.md
//
// 公式テキスト:
//   【FILE6】【宣言】【ターン1】〚デッキの下に移す〛：自分のリムーブエリアにあるレベル7以下の〚カード名［毛利蘭］〛を1枚まで選び、登場させる。
//   【カットイン】【自分ターン中】〚カード名［毛利蘭］〛に【カットイン】する場合、AP＋3000（自分のターンのコンタクト中に手札からリムーブして使う）
//
// a1: 【FILE6】=fileAtLeast6, 【ターン1】=limit, 〚デッキの下に移す〛=cost selfToDeckBottom (D07008 同型),
//   reanimate = sceneEnter{from:'remove', cardName:'毛利蘭', levelMax:7} (B02053/PR187 同型)。
// a2: 【カットイン】+【自分ターン中】(turn:self gate) + 「毛利蘭にカットインする場合 AP+3000」=
//   conditional(if contactTargetMatches({names:['毛利蘭']}), then charModifyAP+3000) (PR087 同型, custom closure のため手書き)。

import type { AbilityDef, CardDef } from '@/engine/types';
import { contactTargetMatches } from '../_shared/index.js';

const a1: AbilityDef = {
  id: 'a1',
  type: 'declared',
  scope: 'on-scene',
  condition: { kind: 'fileAtLeast', n: 6 }, // 【FILE6】
  limit: { kind: 'turn', n: 1 }, // 【ターン1】
  cost: { kind: 'selfToDeckBottom' }, // 〚デッキの下に移す〛
  // リムーブのレベル7以下[毛利蘭]を1枚まで選び、登場させる
  effect: {
    kind: 'atom',
    verb: 'sceneEnter',
    args: { player: 'self', from: 'remove', max: 1, viaEffect: true, filter: { cardName: '毛利蘭', levelMax: 7, kind: 'character' } },
  },
  description: '【FILE6】【宣言】【ターン1】〚デッキの下に移す〛：リムーブのレベル7以下の〚カード名［毛利蘭］〛を1枚まで選び、登場させる。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/19-special-rules.md', 'rules/21-declared-ability-cost.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-hand',
  trigger: { hook: 'effect:declared', optional: true, selfOnly: true },
  condition: { kind: 'turn', player: 'self' }, // 【自分ターン中】
  // [毛利蘭]に【カットイン】する場合のみ AP＋3000
  effect: {
    kind: 'conditional',
    if: contactTargetMatches({ names: ['毛利蘭'] }),
    then: { kind: 'atom', verb: 'charModifyAP', args: { uid: '$contact.byUid', delta: 3000, scope: 'contact' } },
  },
  description: '【カットイン】【自分ターン中】〚カード名［毛利蘭］〛に【カットイン】する場合、AP＋3000（コンタクト中に手札からリムーブして使う）',
  ruleRefs: ['rules/09-cutin-disguise.md', 'rules/17-icons.md', 'rules/19-special-rules.md', 'rules/22-qa-action-contact.md'],
};

export const D10011: CardDef = {
  id: 'D10011',
  no: '0841/D10011',
  kind: 'character',
  names: ['毛利小五郎'],
  colors: ['青'],
  level: 7,
  ap: 5000,
  lp: 0,
  traits: ['探偵', '毛利探偵事務所'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1761913165346723.jpg',
  abilities: [a1, a2],
  ruleRefs: ['rules/09-cutin-disguise.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/19-special-rules.md', 'rules/21-declared-ability-cost.md', 'rules/22-qa-action-contact.md'],
};
