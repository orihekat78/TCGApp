// cards/ct-d01/D01015 蘭の一撃 (イベント) — catalog-reuse batch
// rules: 15-abilities-effects.md, 17-icons.md, 19-special-rules.md, 20-color-and-switch.md
//
// 公式テキスト:
//   【パートナー青】（パートナーが条件を満たしている場合、この能力か効果を使える）AP8000以下のキャラを1枚まで選び、リムーブする。
//
// a1: eventRemoveByAP({ apMax:8000, additionalCondition:{ partnerColor:'青' } }) — D08025 同型

import type { CardDef } from '@/engine/types';
import { eventRemoveByAP } from '@/cards/_shared';

export const D01015: CardDef = {
  id: 'D01015',
  no: '0103/D01015',
  kind: 'event',
  names: ['蘭の一撃'],
  colors: ['青'],
  level: 5,
  traits: [],
  rarity: 'D',
  imageUrl: '1714013100434344.jpg',
  abilities: [
    eventRemoveByAP({
      apMax: 8000,
      additionalCondition: { kind: 'partnerColor', color: '青' },
      abilityId: 'a1',
    }),
  ],
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/19-special-rules.md',
    'rules/20-color-and-switch.md',
  ],
};
