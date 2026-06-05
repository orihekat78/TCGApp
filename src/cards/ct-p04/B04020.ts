// cards/ct-p04/B04020 綾小路文麿 (キャラ・常時+ヒラメキ) — catalog-reuse batch
// rules: 03-field-areas.md, 10-action-event.md, 13-keywords.md, 17-icons.md, 24-qa-naming-stun.md
//
// 公式テキスト:
//   自分の現場に〚特徴［警察］〛のキャラが3枚以上いる場合、このキャラは〚突撃〛（登場したターンからすぐにアクションできる）を持つ。
//   【ヒラメキ】（証拠からリムーブされるときに発動する）キャラを1枚まで選び、スリープさせる。
//
// a1: continuous — 自分の現場の[警察]が3枚以上で 突撃 を持つ (sceneHas condition + grantKeywords inline / B09093 a1 同型)
// a2: 【ヒラメキ】キャラを1枚まで選び、スリープさせる (D08019 a2 / D11009 a3 同型 $pick 明示 target)

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'continuous',
  scope: 'on-scene',
  // 自分の現場に[警察]のキャラが3枚以上いる場合
  condition: { kind: 'sceneHas', query: { area: 'scene', side: 'self', filter: { trait: '警察' } }, nMin: 3 },
  // 〚突撃〛を持つ
  continuousModifier: { grantKeywords: () => ['突撃'] },
  description: '自分の現場に[警察]が3枚以上いる場合、このキャラは〚突撃〛を持つ。',
  ruleRefs: ['rules/13-keywords.md', 'rules/24-qa-naming-stun.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-evidence',
  trigger: { hook: 'evidence:remove-by-action', optional: true }, // 任意発動
  // キャラを1枚まで選び、スリープさせる
  // 注: hirameki fire は明示 target ($pick + pick query) を保持する (短縮形だと fire 時 side-channel 待ちになる)。
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

export const B04020: CardDef = {
  id: 'B04020',
  no: '0421/B04020',
  kind: 'character',
  names: ['綾小路文麿'],
  colors: ['緑'],
  level: 7,
  ap: 6000,
  lp: 1,
  traits: ['警察', '京都府警'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1735287737391367.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/10-action-event.md',
    'rules/13-keywords.md',
    'rules/17-icons.md',
  ],
};
