// cards/ct-d07/D07016 キール (キャラ) — catalog-reuse batch
// rules: 09-cutin-disguise.md, 11-reasoning.md, 13-keywords.md, 17-icons.md, 22-qa-action-contact.md
//
// 公式テキスト:
//   〚ミスリード1〛（相手の推理に対し、スリープさせることでLP－1する）
//   【カットイン】AP＋1000（コンタクト中に手札からリムーブして使う）
//
// a1: 〚ミスリード1〛 (misreadX 共通クラス — reasoning:before-add listener が処理)
// a2: 【カットイン】AP＋1000 (D08007 同型 inline atom / contact scope)

import type { AbilityDef, CardDef } from '@/engine/types';
import { misreadX } from '@/cards/_shared';

// a1: 〚ミスリード1〛
const a1: AbilityDef = misreadX({ x: 1, abilityId: 'a1' });

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-hand',
  // 【カットイン】(コンタクト中に手札から使用)
  trigger: { hook: 'effect:declared', optional: true, selfOnly: true },
  // コンタクト中の攻撃キャラ ($contact.byUid) を AP＋1000 (コンタクト終了時に切れる)
  effect: { kind: 'atom', verb: 'charModifyAP', args: { uid: '$contact.byUid', delta: 1000, scope: 'contact' } },
  description: '【カットイン】AP＋1000',
  ruleRefs: ['rules/09-cutin-disguise.md', 'rules/22-qa-action-contact.md'],
};

export const D07016: CardDef = {
  id: 'D07016',
  no: '0395/D07016',
  kind: 'character',
  names: ['キール'],
  colors: ['黒'],
  level: 3,
  ap: 2000,
  lp: 1,
  traits: ['黒ずくめの組織'],
  keywords: [],
  rarity: 'D',
  imageUrl: '1729865282050103.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/09-cutin-disguise.md',
    'rules/11-reasoning.md',
    'rules/13-keywords.md',
    'rules/17-icons.md',
  ],
};
