// cards/ct-p06/B06101 キャンティ (character) — Task A certify-harvest needsManual (engine変更0, 手書き closure)
// rules: 09-cutin-disguise.md, 13-keywords.md, 15-abilities-effects.md, 17-icons.md, 22-qa-action-contact.md
//
// 公式テキスト:
//   〚突撃〛（登場したターンからすぐにアクションできる）
//   【カットイン】【黒】のキャラに【カットイン】する場合、AP＋1000（コンタクト中に手札からリムーブして使う）
//
// keywords:['突撃'] = 印字キーワード。
// 【カットイン】= triggered scope:'on-hand' trigger:{effect:declared, optional, selfOnly} (PR087 同型)。
//   「【黒】のキャラに【カットイン】する場合 AP+1000」= conditional(if contactTargetMatches({colors:['黒']}),
//   then charModifyAP{$contact.byUid,+1000,contact})。contactTargetMatches は custom 条件 closure のため手書き。

import type { AbilityDef, CardDef } from '@/engine/types';
import { contactTargetMatches } from '../_shared/index.js';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-hand',
  trigger: { hook: 'effect:declared', optional: true, selfOnly: true },
  // 【黒】のキャラに【カットイン】する場合のみ AP＋1000
  effect: {
    kind: 'conditional',
    if: contactTargetMatches({ colors: ['黒'] }),
    then: { kind: 'atom', verb: 'charModifyAP', args: { uid: '$contact.byUid', delta: 1000, scope: 'contact' } },
  },
  description: '【カットイン】【黒】のキャラに【カットイン】する場合、AP＋1000（コンタクト中に手札からリムーブして使う）',
  ruleRefs: ['rules/09-cutin-disguise.md', 'rules/17-icons.md', 'rules/22-qa-action-contact.md'],
};

export const B06101: CardDef = {
  id: 'B06101',
  no: '0718/B06101',
  kind: 'character',
  names: ['キャンティ'],
  colors: ['黒'],
  level: 7,
  ap: 6000,
  lp: 0,
  traits: ['黒ずくめの組織'],
  keywords: ['突撃'],
  rarity: 'C',
  imageUrl: '1768291084060844.jpg',
  abilities: [a1],
  ruleRefs: ['rules/09-cutin-disguise.md', 'rules/13-keywords.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/22-qa-action-contact.md'],
};
