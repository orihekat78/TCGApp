// cards/ct-p07/B07056 怪盗キッドと中森王女 (イベント) — catalog-reuse batch
// rules: 03-field-areas.md, 15-abilities-effects.md, 17-icons.md, 19-special-rules.md, 20-color-and-switch.md
//
// 公式テキスト:
//   自分の現場にいるレベル8以下の〚カード名［黒羽快斗］〛か〚［中森青子］〛を1枚まで選び、アクティブにする。
//   このイベントは自分の現場にスリープ状態の〚カード名［小泉紅子］〛がいる場合に使用できる。
//
// a1: effect:declared (event-use matcher) → sceneSetState(active) 短縮形 (D08019 a1 / B01040 a1 同型)。
//     対象は自分の現場の Lv8以下 [黒羽快斗]/[中森青子] (cardName OR)。
//     使用条件 (condition) は 自分の現場にスリープ状態の [小泉紅子] が居ること (sceneHas + state)。

import type { AbilityDef, CardDef, GameState } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-hand',
  trigger: {
    hook: 'effect:declared',
    selfOnly: true,
    matcher: (p: unknown, _s: GameState) => (p as { kind?: unknown })?.kind === 'event-use',
  },
  // このイベントは自分の現場にスリープ状態の[小泉紅子]がいる場合に使用できる
  condition: { kind: 'sceneHas', query: { area: 'scene', side: 'self', filter: { cardName: '小泉紅子' }, state: ['sleep'] }, nMin: 1 },
  // 自分の現場のレベル8以下の[黒羽快斗]か[中森青子]を1枚まで選び、アクティブにする
  effect: { kind: 'atom', verb: 'sceneSetState', args: { player: 'self', max: 1, side: 'self', state: 'active', filter: { cardName: ['黒羽快斗', '中森青子'], levelMax: 8 } } },
  description:
    '自分の現場のレベル8以下の[黒羽快斗]か[中森青子]を1枚まで選び、アクティブにする (現場にスリープ状態の[小泉紅子]が居る場合に使用可)。',
  ruleRefs: ['rules/03-field-areas.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

export const B07056: CardDef = {
  id: 'B07056',
  no: '0785/B07056',
  kind: 'event',
  names: ['怪盗キッドと中森王女'],
  colors: ['白'],
  level: 6,
  traits: [],
  rarity: 'C',
  imageUrl: '1762414010605363.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/15-abilities-effects.md',
    'rules/19-special-rules.md',
    'rules/20-color-and-switch.md',
  ],
};
