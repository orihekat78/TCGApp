// cards/ct-p08/B08080 キール (キャラ) — catalog-reuse batch
// rules: 09-cutin-disguise.md, 13-keywords.md, 17-icons.md, 22-qa-action-contact.md
//
// 公式テキスト:
//   【パートナー黒】〚突撃［事件］〛（登場したターンからすぐに事件を指定してアクションできる）
//   【カットイン】AP＋1000（コンタクト中に手札からリムーブして使う）
//
// a1: 【パートナー黒】で 突撃[事件] を付与する常時有効型 (partnerColorKeyword 共通)。
// a2: 【カットイン】AP＋1000 (inline — D08015 a2 同型)。

import type { AbilityDef, CardDef } from '@/engine/types';
import { partnerColorKeyword } from '@/cards/_shared';

// a1: 【パートナー黒】〚突撃［事件］〛
const a1: AbilityDef = partnerColorKeyword({ color: '黒', kw: '突撃[事件]', abilityId: 'a1' });

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

export const B08080: CardDef = {
  id: 'B08080',
  no: '0916/B08080',
  kind: 'character',
  names: ['キール'],
  colors: ['黒'],
  level: 6,
  ap: 6000,
  lp: 0,
  traits: ['黒ずくめの組織'],
  keywords: [],
  rarity: 'R',
  imageUrl: '1770731255812247.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/09-cutin-disguise.md',
    'rules/13-keywords.md',
    'rules/17-icons.md',
    'rules/22-qa-action-contact.md',
  ],
};
