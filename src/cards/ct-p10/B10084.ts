// CT-P10 B10084 キール (partner, C / CP printings)
// rules: 01-victory-conditions.md, 13-keywords.md
// The printed 【事件解決】 / 【アシスト】 text is the shared partner rule.
import type { CardDef } from '@/engine/types';

const base = {
  kind: 'partner' as const,
  names: ['キール'],
  colors: ['黒'],
  lp: 1,
  traits: [],
  abilities: [],
  standardPartnerActions: true as const,
  ruleRefs: ['rules/01-victory-conditions.md', 'rules/13-keywords.md'],
};

export const B10084: CardDef = {
  ...base,
  id: 'B10084',
  no: 'P088/B10084',
  rarity: 'C',
  imageUrl: '1783904202733762.jpg',
};

export const B10084P: CardDef = {
  ...base,
  id: 'B10084P',
  no: 'P088/B10084P',
  rarity: 'CP',
  imageUrl: '1783904202741944.jpg',
};
