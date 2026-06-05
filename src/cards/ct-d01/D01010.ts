// cards/ct-d01/D01010 円谷光彦 (キャラ) — catalog-reuse batch
// rules: 09-cutin-disguise.md, 11-reasoning.md, 13-keywords.md, 17-icons.md, 22-qa-action-contact.md
//
// 公式テキスト:
//   〚ミスリード1〛（相手の推理に対し、スリープさせることでLP－1する）
//   【カットイン】AP＋1000（コンタクト中に手札からリムーブして使う）
//
// a1: 〚ミスリード1〛 — misreadX({x:1}) 共通クラス。a2: 【カットイン】AP＋1000 — D03010/D08007 同型。

import type { AbilityDef, CardDef } from '@/engine/types';
import { misreadX } from '@/cards/_shared';

const a1 = misreadX({ x: 1, abilityId: 'a1' });

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-hand',
  trigger: { hook: 'effect:declared', optional: true, selfOnly: true },
  // コンタクト中の攻撃キャラを AP＋1000 (コンタクト終了時まで)
  effect: { kind: 'atom', verb: 'charModifyAP', args: { uid: '$contact.byUid', delta: 1000, scope: 'contact' } },
  description: '【カットイン】AP＋1000（コンタクト中に手札からリムーブして使う）',
  ruleRefs: ['rules/09-cutin-disguise.md', 'rules/22-qa-action-contact.md'],
};

export const D01010: CardDef = {
  id: 'D01010',
  no: '0099/D01010',
  kind: 'character',
  names: ['円谷光彦'],
  colors: ['青'],
  level: 3,
  ap: 2000,
  lp: 1,
  traits: ['少年探偵団'],
  keywords: [],
  rarity: 'D',
  imageUrl: '1714013100418997.jpg',
  abilities: [a1, a2],
  ruleRefs: ['rules/09-cutin-disguise.md', 'rules/11-reasoning.md', 'rules/13-keywords.md', 'rules/17-icons.md'],
};
