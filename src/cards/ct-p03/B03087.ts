// cards/ct-p03/B03087 萩原研二 (キャラ) — catalog-reuse batch
// rules: 05-turn-phases.md, 07-action-flow.md, 13-keywords.md, 15-abilities-effects.md, 17-icons.md
//
// 公式テキスト:
//   【パートナー黄】【登場時】相手の現場にキャラが3枚以上いる場合、ターン終了時までこのキャラは〚突撃［キャラ］〛（登場したターンからすぐにキャラを指定してアクションできる）を持つ。
//
// a1: 【パートナー黄】【登場時】(enter trigger) 条件付き — 相手の現場にキャラ3枚以上なら
//     ターン終了時まで自身に 〚突撃[キャラ]〛 付与 (charGrantKeyword scope:turn / D11015 a2 同型)。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  // 【パートナー黄】
  condition: { kind: 'partnerColor', color: '黄' },
  // 【登場時】
  trigger: { hook: 'enter', selfOnly: true },
  effect: {
    kind: 'conditional',
    // 相手の現場にキャラが3枚以上いる場合
    if: { kind: 'sceneHas', query: { area: 'scene', side: 'opp' }, nMin: 3 },
    // ターン終了時までこのキャラは〚突撃[キャラ]〛を持つ
    then: { kind: 'atom', verb: 'charGrantKeyword', args: { uid: '$self', kw: '突撃[キャラ]', scope: 'turn' } },
  },
  description: '【パートナー黄】【登場時】相手の現場にキャラが3枚以上いる場合、ターン終了時までこのキャラは〚突撃［キャラ］〛を持つ。',
  ruleRefs: ['rules/13-keywords.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

export const B03087: CardDef = {
  id: 'B03087',
  no: '0340/B03087',
  kind: 'character',
  names: ['萩原研二'],
  colors: ['黄'],
  level: 6,
  ap: 6000,
  lp: 1,
  traits: ['警察', '警視庁'],
  keywords: [],
  rarity: 'R',
  imageUrl: '1729133443636657.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/05-turn-phases.md',
    'rules/07-action-flow.md',
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
  ],
};
