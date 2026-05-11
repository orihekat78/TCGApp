// cards/ct-d11/D11011 萩原千速 (キャラ・解決編迅速)
// rules: 01-victory-conditions.md, 13-keywords.md, 17-icons.md, 24-qa-naming-stun.md
// spec: .claude/specs/cards-analysis/D11011.md
//
// 公式テキスト:
//   【パートナー黄】【解決編】〚迅速〛（名乗り状態でも推理かアクションできる）

import type { CardDef } from '@/engine/types';
import { partnerColorKeyword } from '../_shared/index.js';

export const D11011: CardDef = {
  id: 'D11011',
  no: '0461/D11011',
  kind: 'character',
  names: ['萩原千速'],
  colors: ['黄'],
  level: 5,
  ap: 5000,
  lp: 0,
  traits: ['警察', '神奈川県警'],
  keywords: [],
  rarity: 'D',
  imageUrl: '1775608962497007.jpg',
  abilities: [
    partnerColorKeyword({
      color: '黄',
      kw: '迅速',
      additionalCondition: { kind: 'caseStatus', status: '解決編' },
      abilityId: 'a1',
    }),
  ],
  ruleRefs: [
    'rules/01-victory-conditions.md',
    'rules/13-keywords.md',
    'rules/17-icons.md',
  ],
};
