// cards/ct-d04/D04015 赤井の射撃 (イベント) — catalog-reuse batch
// rules: 09-cutin-disguise.md, 15-abilities-effects.md, 17-icons.md, 19-special-rules.md, 20-color-and-switch.md
//
// 公式テキスト:
//   【パートナー赤】（パートナーが条件を満たしている場合、この能力か効果を使える）
//     AP8000以下のキャラを1枚まで選び、リムーブする。
//
// a1: eventRemoveByAP({ apMax:8000, additionalCondition:{ partnerColor:'赤' } }) — D08025 同型

import type { CardDef } from '@/engine/types';
import { eventRemoveByAP } from '@/cards/_shared';

export const D04015: CardDef = {
  id: 'D04015',
  no: '0145/D04015',
  kind: 'event',
  names: ['赤井の射撃'],
  colors: ['赤'],
  level: 5,
  traits: [],
  rarity: 'D',
  imageUrl: '1714013167763076.jpg',
  abilities: [
    eventRemoveByAP({
      apMax: 8000,
      additionalCondition: { kind: 'partnerColor', color: '赤' },
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
