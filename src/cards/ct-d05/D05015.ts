// cards/ct-d05/D05015 安室の一撃 (イベント) — catalog-reuse batch
// rules: 15-abilities-effects.md, 17-icons.md, 19-special-rules.md, 20-color-and-switch.md
//
// 公式テキスト:
//   【パートナー黄】（パートナーが条件を満たしている場合、この能力か効果を使える）AP8000以下のキャラを1枚まで選び、リムーブする。
//
// a1: eventRemoveByAP({ apMax:8000, additionalCondition:{ partnerColor:'黄' } })

import type { CardDef } from '@/engine/types';
import { eventRemoveByAP } from '@/cards/_shared';

export const D05015: CardDef = {
  id: 'D05015',
  no: '0159/D05015',
  kind: 'event',
  names: ['安室の一撃'],
  colors: ['黄'],
  level: 5,
  traits: [],
  rarity: 'D',
  imageUrl: '1714013167816638.jpg',
  abilities: [
    eventRemoveByAP({
      apMax: 8000,
      additionalCondition: { kind: 'partnerColor', color: '黄' },
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
