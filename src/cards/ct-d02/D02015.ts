// cards/ct-d02/D02015 平次の洞察力 (イベント) — catalog-reuse batch
// rules: 15-abilities-effects.md, 17-icons.md, 19-special-rules.md, 20-color-and-switch.md
//
// 公式テキスト:
//   【パートナー緑】（パートナーが条件を満たしている場合、この能力か効果を使える）AP8000以下のキャラを1枚まで選び、リムーブする。
//
// a1: eventRemoveByAP({ apMax:8000, additionalCondition:{ partnerColor:'緑' } }) — D08025 同型

import type { CardDef } from '@/engine/types';
import { eventRemoveByAP } from '@/cards/_shared';

export const D02015: CardDef = {
  id: 'D02015',
  no: '0117/D02015',
  kind: 'event',
  names: ['平次の洞察力'],
  colors: ['緑'],
  level: 5,
  traits: [],
  rarity: 'D',
  imageUrl: '1714013117390168.jpg',
  abilities: [
    eventRemoveByAP({
      apMax: 8000,
      additionalCondition: { kind: 'partnerColor', color: '緑' },
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
