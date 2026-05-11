// cards/ct-d08/D08009 小嶋元太 (キャラ)
// rules: 13-keywords.md, 17-icons.md, 22-qa-action-contact.md, 24-qa-naming-stun.md
// spec: .claude/specs/cards-analysis/D08009.md
//
// 公式テキスト:
//   【パートナー青】〚突撃〛（登場したターンからすぐにアクションできる）

import type { CardDef } from '@/engine/types';
import { partnerColorKeyword } from '../_shared/index.js';

export const D08009: CardDef = {
  id: 'D08009',
  no: '0492/D08009',
  kind: 'character',
  names: ['小嶋元太'],
  colors: ['青'],
  level: 5,
  ap: 5000,
  lp: 0,
  traits: ['少年探偵団'],
  keywords: [],
  rarity: 'D',
  imageUrl: '1743743093465803.jpg',
  abilities: [partnerColorKeyword({ color: '青', kw: '突撃', abilityId: 'a1' })],
  ruleRefs: ['rules/13-keywords.md', 'rules/17-icons.md'],
};
