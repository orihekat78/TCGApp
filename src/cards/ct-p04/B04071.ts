// cards/ct-p04/B04071 風見裕也 (キャラ・登場時+ヒラメキ) — catalog-reuse batch
// rules: 03-field-areas.md, 10-action-event.md, 15-abilities-effects.md, 17-icons.md, 24-qa-naming-stun.md
//
// 公式テキスト:
//   【登場時】自分の現場に〚特徴［警察］〛のキャラが3枚以上いる場合、スリープ状態のキャラを1枚まで選び、スタンさせる。（スタン状態のキャラをアクティブにする場合、代わりにスリープさせる）
//   【ヒラメキ】（証拠からリムーブされるときに発動する）自分のリムーブエリアにある〚カード名［降谷零］〛を1枚まで選び、手札に加える。
//
// a1: 【登場時】条件(自現場の[警察]3枚以上) → スリープ状態のキャラを1枚までスタン (D08019 a1 conditional + B03054 a2 の state:['sleep'] sceneSetState stun 同型)
//     ※（）内はスタンの一般挙動の注記であり engine 既定処理 (rules/03/24)。
// a2: 【ヒラメキ】リムーブの[降谷零]を1枚まで選び、手札に加える (B04025 a2 / D11012 a2 handAddFromRemove 同型)

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'enter', selfOnly: true },
  effect: {
    kind: 'conditional',
    // 自分の現場に〚特徴［警察］〛のキャラが3枚以上いる場合
    if: { kind: 'sceneHas', query: { area: 'scene', side: 'self', filter: { trait: '警察' } }, nMin: 3 },
    // スリープ状態のキャラを1枚まで選び、スタンさせる (B03054 a2 同型: query.state=候補フィルタ / state='stun'=設定先)
    then: {
      kind: 'choice',
      chooser: 'self',
      options: [
        {
          kind: 'atom',
          verb: 'sceneSetState',
          args: {
            uid: '$pick',
            state: 'stun',
            target: { kind: 'pick', query: { area: 'scene', side: 'either', state: ['sleep'] }, n: { min: 0, max: 1 }, chooser: 'self' },
          },
        },
      ],
    },
  },
  description: '【登場時】自現場に[警察]3枚以上の場合、スリープ状態のキャラを1枚までスタンさせる。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/03-field-areas.md', 'rules/24-qa-naming-stun.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-evidence',
  trigger: { hook: 'evidence:remove-by-action', optional: true }, // 任意発動
  // 自分のリムーブエリアにある〚カード名［降谷零］〛を1枚まで選び、手札に加える
  effect: { kind: 'atom', verb: 'handAddFromRemove', args: { player: 'self', max: 1, filter: { cardName: '降谷零' } } },
  description: '【ヒラメキ】リムーブの[降谷零]を1枚まで選び、手札に加える。',
  ruleRefs: ['rules/10-action-event.md', 'rules/14-refresh.md'],
};

export const B04071: CardDef = {
  id: 'B04071',
  no: '0457/B04071',
  kind: 'character',
  names: ['風見裕也'],
  colors: ['黄'],
  level: 6,
  ap: 5000,
  lp: 1,
  traits: ['警察', '警視庁', '公安'],
  keywords: [],
  rarity: 'R',
  imageUrl: '1735287822598161.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/10-action-event.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/24-qa-naming-stun.md',
  ],
};
