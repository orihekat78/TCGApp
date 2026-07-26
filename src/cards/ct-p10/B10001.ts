// CT-P10 B10001 赤木英雄 (partner)
// rules: 01-victory-conditions.md, 13-keywords.md
import type { CardDef } from '@/engine/types';

export const B10001: CardDef = {
  id: 'B10001', no: 'P082/B10001', kind: 'partner', names: ['赤木英雄'], colors: ['青'], lp: 1,
  traits: [], rarity: 'C', imageUrl: '1783904055214795.jpg', abilities: [], standardPartnerActions: true,
  ruleRefs: ['rules/01-victory-conditions.md', 'rules/13-keywords.md'],
};
export const B10001P: CardDef = { ...B10001, id: 'B10001P', no: 'P082/B10001P', rarity: 'CP', imageUrl: '1783904055232810.jpg' };
