// cards/ct-d08/D08025 蘭の一撃 (イベント)
// rules: 09-cutin-disguise.md, 15-abilities-effects.md, 17-icons.md, 19-special-rules.md, 20-color-and-switch.md
// spec: .claude/specs/cards-analysis/D08025.md
//
// 公式テキスト:
//   【パートナー青】AP8000以下のキャラを1枚まで選び、リムーブする。
//
// a1: eventRemoveByAP({ apMax:8000, additionalCondition:{ partnerColor:'青' } })

import type { CardDef } from '@/engine/types';
import { eventRemoveByAP } from '@/cards/_shared/eventRemoveByAP';

export const D08025: CardDef = {
  id: 'D08025',
  no: '0103/D08025',
  kind: 'event',
  names: ['蘭の一撃'],
  colors: ['青'],
  level: 5,
  traits: [],
  rarity: 'D',
  imageUrl: '1743743100634648.jpg',
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
  ],
};
