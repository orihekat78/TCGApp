// cards/ct-p06/B06056 河童野ケロ吉 (キャラ) — catalog-reuse batch
// rules: 09-cutin-disguise.md, 13-keywords.md, 17-icons.md, 22-qa-action-contact.md
//
// 公式テキスト:
//   〚ミスリード1〛（相手の推理に対し、スリープさせることでLP－1する）
//   [カットイン欄] 【カットイン】AP＋1000（コンタクト中に手札からリムーブして使う）
//
// a1: 〚ミスリード1〛= misreadX 共通クラス (reasoning:before-add listener が処理)。
// a2: 【カットイン】AP＋1000 (D08015 a2 同型 — effect:declared on-hand で $contact.byUid を contact scope 加算)。

import type { AbilityDef, CardDef } from '@/engine/types';
import { misreadX } from '@/cards/_shared';

// a1: 〚ミスリード1〛
const a1: AbilityDef = misreadX({ x: 1, abilityId: 'a1' });

// a2: 【カットイン】AP＋1000 — コンタクト中の攻撃キャラ ($contact.byUid) を contact scope で加算
const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-hand',
  trigger: { hook: 'effect:declared', optional: true, selfOnly: true }, // 【カットイン】(コンタクト中に手札から使用)
  effect: { kind: 'atom', verb: 'charModifyAP', args: { uid: '$contact.byUid', delta: 1000, scope: 'contact' } },
  description: '【カットイン】AP＋1000',
  ruleRefs: ['rules/09-cutin-disguise.md', 'rules/22-qa-action-contact.md'],
};

export const B06056: CardDef = {
  id: 'B06056',
  no: '0677/B06056',
  kind: 'character',
  names: ['河童野ケロ吉'],
  colors: ['白'],
  level: 3,
  ap: 2000,
  lp: 1,
  traits: ['YAIBA'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1754285220500521.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/09-cutin-disguise.md',
    'rules/13-keywords.md',
    'rules/17-icons.md',
    'rules/22-qa-action-contact.md',
  ],
};
