// cards/ct-d07/D07022 「裏切り者は匂いを消せねぇからな…」 (イベント) — catalog-reuse batch
// rules: 15-abilities-effects.md, 17-icons.md, 19-special-rules.md, 20-color-and-switch.md
//
// 公式テキスト:
//   【パートナー黒】（パートナーが条件を満たしている場合、この能力か効果を使える）
//   AP8000以下のキャラを1枚まで選び、リムーブする。
//
// a1: eventRemoveByAP({ apMax:8000, additionalCondition:{ partnerColor:'黒' } }) — D08025 同型

import type { CardDef } from '@/engine/types';
import { eventRemoveByAP } from '@/cards/_shared';

export const D07022: CardDef = {
  id: 'D07022',
  no: '0397/D07022',
  kind: 'event',
  names: ['「裏切り者は匂いを消せねぇからな…」'],
  colors: ['黒'],
  level: 5,
  traits: [],
  rarity: 'D',
  imageUrl: '1729865297331543.jpg',
  abilities: [
    eventRemoveByAP({
      apMax: 8000,
      additionalCondition: { kind: 'partnerColor', color: '黒' },
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
