// cards/ct-d08/D08017 円谷光彦 (キャラ)
// rules: 09-cutin-disguise.md, 17-icons.md, 22-qa-action-contact.md
// spec: .claude/specs/cards-analysis/D08017.md
//
// 公式テキスト:
//   【カットイン】AP＋2000

import type { CardDef } from '@/engine/types';
import { cutinFixedAP } from '../_shared/index.js';

export const D08017: CardDef = {
  id: 'D08017',
  no: '0496/D08017',
  kind: 'character',
  names: ['円谷光彦'],
  colors: ['青'],
  level: 2,
  ap: 1000,
  lp: 1,
  traits: ['少年探偵団'],
  keywords: [],
  rarity: 'D',
  imageUrl: '1743743093502674.jpg',
  abilities: [cutinFixedAP({ delta: 2000, abilityId: 'a1' })],
  ruleRefs: ['rules/09-cutin-disguise.md', 'rules/22-qa-action-contact.md'],
};
