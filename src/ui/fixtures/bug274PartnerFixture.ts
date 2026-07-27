// BUG-274 public UI regression fixture.
//
// This is not an official card and is registered only when the explicitly
// labelled TEST-BUG-274 deck is selected from the public setup UI.

import type { CardDef } from '@/engine/types';

export const BUG_274_PARTNER: CardDef = {
  id: 'TEST-BUG-274-PARTNER',
  no: 'TEST-BUG-274-PARTNER',
  kind: 'partner',
  names: ['BUG-274 検証パートナー'],
  colors: ['青'],
  lp: 1,
  traits: [],
  rarity: 'TEST',
  imageUrl: '',
  abilities: [
    {
      id: 'choose-a',
      name: '選択肢 A',
      type: 'declared',
      description: '検証専用能力 A（実行しない）',
      ruleRefs: ['.claude/bugs/BUG-274.md'],
    },
    {
      id: 'choose-b',
      name: '選択肢 B',
      type: 'declared',
      description: '検証専用能力 B（実行しない）',
      ruleRefs: ['.claude/bugs/BUG-274.md'],
    },
  ],
  ruleRefs: ['.claude/bugs/BUG-274.md'],
};
