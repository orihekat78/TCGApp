// cards/ct-p03/B03063 死闘 (event) — Cluster WB1 exemplar (sceneSetState dyn-max pick)
// rules: rules/03-field-areas.md, rules/10-action-event.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/19-special-rules.md, rules/20-color-and-switch.md
// 公式テキスト:
//   自分の現場にいる〚特徴［空手家］〛のキャラと同じ数まで相手の現場にいるキャラを選び、スリープさせる。自分の現場にいる〚特徴［空手家］〛のすべてのキャラをターン終了時までAP＋1000する。
//   【ヒラメキ】（証拠からリムーブされるときに発動する）キャラを1枚まで選び、スリープさせる。
// 句マッピング:
//   - 「自分の現場の〚空手家〛と同じ数まで相手キャラを選び、スリープ」=> sceneSetState 短縮形
//     {player:'self'(chooser), side:'opp', state:'sleep', max:{dyn:'$self.sceneTrait.空手家'}}。
//     Cluster WB1 で sceneSetState が dyn max を短縮形 gate 前に literalize (scene.ts)。「〜まで」= 0枚可 (rules/15)。
//   - 「自分の現場の〚空手家〛すべてをターン終了時までAP＋1000」=> forEach over:{kind:'all', query:
//     {area:'scene', side:'self', filter:{trait:'空手家'}}} do: charModifyAP {uid:'$each.uid', delta:1000, scope:'turn'}
//     (D02004/B07098 forEach-all + $each.uid idiom、foreach-all.test.ts で primitive 検証済)。
//     Q&A: 「イベントの効果を解決した時点で現場にいる空手家」= 解決時点の盤面 (forEach over-all = 解決時列挙)。
//   - 【ヒラメキ】キャラを1枚まで選びスリープ => evidence:remove-by-action(optional) → sceneSetState pick
//     max:1 side:'either' (D01012/D08019 hirameki 同型)。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-hand',
  trigger: {
    hook: 'effect:declared',
    selfOnly: true,
    matcher: (p: unknown) => (p as { kind?: unknown })?.kind === 'event-use'
  },
  effect: {
    kind: 'sequence',
    steps: [
      {
        kind: 'atom',
        verb: 'sceneSetState',
        args: {
          player: 'self',
          side: 'opp',
          state: 'sleep',
          max: { dyn: '$self.sceneTrait.空手家' }
        }
      },
      {
        kind: 'forEach',
        over: {
          kind: 'all',
          query: {
            area: 'scene',
            side: 'self',
            filter: {
              trait: '空手家'
            }
          }
        },
        do: {
          kind: 'atom',
          verb: 'charModifyAP',
          args: {
            uid: '$each.uid',
            delta: 1000,
            scope: 'turn'
          }
        }
      }
    ]
  },
  description: '自分の現場にいる〚特徴［空手家］〛のキャラと同じ数まで相手の現場にいるキャラを選び、スリープさせる。自分の現場にいる〚特徴［空手家］〛のすべてのキャラをターン終了時までAP＋1000する。',
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/15-abilities-effects.md',
    'rules/19-special-rules.md',
    'rules/20-color-and-switch.md'
  ]
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-evidence',
  trigger: {
    hook: 'evidence:remove-by-action',
    optional: true
  },
  effect: {
    kind: 'atom',
    verb: 'sceneSetState',
    args: {
      uid: '$pick',
      state: 'sleep',
      target: { kind: 'pick', query: { area: 'scene', side: 'either' }, n: { min: 0, max: 1 }, chooser: 'self' }
    }
  },
  description: '【ヒラメキ】（証拠からリムーブされるときに発動する）キャラを1枚まで選び、スリープさせる。',
  ruleRefs: [
    'rules/10-action-event.md',
    'rules/17-icons.md'
  ]
};

export const B03063: CardDef = {
  id: 'B03063',
  no: '0318/B03063',
  kind: 'event',
  names: [
    '死闘'
  ],
  colors: [
    '白'
  ],
  level: 5,
  traits: [],
  rarity: 'C',
  imageUrl: '1729133406805746.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/10-action-event.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/19-special-rules.md',
    'rules/20-color-and-switch.md'
  ],
};
