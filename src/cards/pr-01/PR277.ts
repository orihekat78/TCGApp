// cards/pr-01/PR277 萩原千速 (character) — Task A green候補 (engine変更0)
// rules: rules/13-keywords.md, rules/17-icons.md, rules/11-reasoning.md, rules/07-action-flow.md
// 公式テキスト:
//   【パートナー黄】【解決編】〚迅速〛（名乗り状態でも推理かアクションできる）

import type { CardDef } from '@/engine/types';
import { partnerColorKeyword } from '@/cards/_shared';

const a1 = partnerColorKeyword({
  color: '黄',
  kw: '迅速',
  additionalCondition: {
    kind: 'caseStatus',
    status: '解決編'
  },
  abilityId: 'a1'
});

export const PR277: CardDef = {
  id: 'PR277',
  no: '0461/PR277',
  kind: 'character',
  names: [
    '萩原千速'
  ],
  colors: [
    '黄'
  ],
  level: 5,
  ap: 5000,
  lp: 0,
  traits: [
    '警察',
    '神奈川県警'
  ],
  rarity: 'PR',
  imageUrl: '1782441097676450.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/13-keywords.md',
    'rules/17-icons.md',
    'rules/11-reasoning.md',
    'rules/07-action-flow.md'
  ],
};
