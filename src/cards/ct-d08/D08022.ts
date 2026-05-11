// cards/ct-d08/D08022 江戸川コナン (キャラ)
// rules: 13-keywords.md, 17-icons.md, 24-qa-naming-stun.md
// spec: .claude/specs/cards-analysis/D08022.md
//
// 公式テキスト:
//   【パートナー青】〚迅速〛

import type { CardDef } from '@/engine/types';
import { partnerColorKeyword } from '../_shared/index.js';

export const D08022: CardDef = {
  id: 'D08022',
  no: '0091/D08022',
  kind: 'character',
  names: ['江戸川コナン'],
  colors: ['青'],
  level: 7,
  ap: 6000,
  lp: 1,
  traits: ['探偵', '毛利探偵事務所', '少年探偵団'],
  keywords: [],
  rarity: 'D',
  imageUrl: '1743743100620300.jpg',
  abilities: [partnerColorKeyword({ color: '青', kw: '迅速', abilityId: 'a1' })],
  ruleRefs: ['rules/13-keywords.md', 'rules/17-icons.md'],
};
