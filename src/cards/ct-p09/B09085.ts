// cards/ct-p09/B09085 目暮十三 (キャラ) — catalog-reuse batch
// rules: 13-keywords.md, 15-abilities-effects.md, 17-icons.md
//
// 公式テキスト:
//   【登場時】自分の現場にいるレベル7以上の【白】の〚特徴［警察］〛のキャラを1枚まで選び、ターン終了時まで〚突撃〛（名乗り状態でもアクションできる）を与える。
//
// a1: 【登場時】 charGrantKeyword 明示 target pick (levelMin:7, color:白, trait:警察, side:self) で
//     対象に 突撃 (turn) を付与。D08019 a2 / D08026 a2 と同じ「uid:'$pick' + 明示 target:{kind:'pick'}」形
//     (短縮形でない明示 target は AI/human 両経路で applyPickAndContinuation が verb 非依存に解決する)。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'enter', selfOnly: true },
  // 自分の現場のレベル7以上の【白】の〚特徴［警察］〛を1枚まで選び、ターン終了時まで〚突撃〛を与える。
  effect: {
    kind: 'atom',
    verb: 'charGrantKeyword',
    args: {
      uid: '$pick',
      kw: '突撃',
      scope: 'turn',
      target: {
        kind: 'pick',
        query: { area: 'scene', side: 'self', filter: { levelMin: 7, color: '白', trait: '警察' } },
        n: { min: 0, max: 1 },
        chooser: 'self',
      },
    },
  },
  description: '【登場時】自分の現場のレベル7以上の【白】の[警察]を1枚まで選び、ターン終了時まで〚突撃〛を与える。',
  ruleRefs: ['rules/13-keywords.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

export const B09085: CardDef = {
  id: 'B09085',
  no: '1025/B09085',
  kind: 'character',
  names: ['目暮十三'],
  colors: ['黄'],
  level: 6,
  ap: 4000,
  lp: 1,
  traits: ['警察', '警視庁'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1775608910375614.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
  ],
};
