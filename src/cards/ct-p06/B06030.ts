// cards/ct-p06/B06030 松尾芭蕉 (キャラ) — catalog-reuse batch
// rules: 03-field-areas.md, 10-action-event.md, 13-keywords.md, 14-refresh.md, 17-icons.md
//
// 公式テキスト:
//   〚ミスリード1〛（相手の推理に対し、スリープさせることでLP－1する）
//   【ヒラメキ】（証拠からリムーブされるときに発動する）キャラを1枚まで選び、スリープさせる。
//
// a1: 〚ミスリード1〛 — misreadX 共通 (icon-misread)
// a2: 【ヒラメキ】キャラを1枚まで選び、スリープさせる — D08019 a2 同型 (evidence:remove-by-action / sceneSetState sleep)

import type { AbilityDef, CardDef } from '@/engine/types';
import { misreadX } from '@/cards/_shared';

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-evidence',
  trigger: { hook: 'evidence:remove-by-action', optional: true }, // 任意発動
  // キャラを1枚まで選び、スリープさせる
  // 注: hirameki fire は hiramekiResolve handler が chooseAtomTarget で $pick を自動解決するため、
  //     明示 target ($pick + pick query) を保持する (D08019 a2 同型)。
  effect: {
    kind: 'choice',
    chooser: 'self',
    options: [
      {
        kind: 'atom',
        verb: 'sceneSetState',
        args: { uid: '$pick', state: 'sleep', target: { kind: 'pick', query: { area: 'scene', side: 'either' }, n: { min: 0, max: 1 }, chooser: 'self' } },
      },
    ],
  },
  description: '【ヒラメキ】キャラを1枚まで選び、スリープさせる。',
  ruleRefs: ['rules/10-action-event.md', 'rules/03-field-areas.md'],
};

export const B06030: CardDef = {
  id: 'B06030',
  no: '0653/B06030',
  kind: 'character',
  names: ['松尾芭蕉'],
  colors: ['緑'],
  level: 3,
  ap: 2000,
  lp: 1,
  traits: ['YAIBA'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1754285189434817.jpg',
  abilities: [misreadX({ x: 1, abilityId: 'a1' }), a2],
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/10-action-event.md',
    'rules/13-keywords.md',
    'rules/14-refresh.md',
    'rules/17-icons.md',
  ],
};
