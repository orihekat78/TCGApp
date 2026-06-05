// cards/pr-01/PR156 「もう少し引き付けろ…」 (イベント) — catalog-reuse batch
// rules: 07-action-flow.md, 13-keywords.md, 15-abilities-effects.md, 17-icons.md, 20-color-and-switch.md
//
// 公式テキスト:
//   【パートナー赤】レベル7以下のキャラを1枚まで選び、リムーブする。自分の現場にいるキャラを1枚まで選び、ターン終了時まで〚突撃［事件］〛（登場したターンからすぐに事件を指定してアクションできる）を与える。
//
// a1: イベント使用時 (effect:declared / matcher kind:'event-use') 発火 / 【パートナー赤】で gate。sequence で
//     ① レベル7以下のキャラを1枚まで選び、リムーブ (sceneRemove $pick, levelMax:7, either)
//     ② 自分の現場のキャラを1枚まで選び、ターン終了時まで 突撃[事件] を付与 (charGrantKeyword $pick, side:self)
//     ※ 2 つは別 pick のため sequence (B01094 a1 同型の DSL コンパクト形)。

import type { AbilityDef, CardDef, GameState } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-hand',
  // 【パートナー赤】
  condition: { kind: 'partnerColor', color: '赤' },
  trigger: {
    hook: 'effect:declared',
    selfOnly: true,
    matcher: (p: unknown, _s: GameState) => (p as { kind?: unknown })?.kind === 'event-use', // このイベント自身が使われたとき発火
  },
  effect: {
    kind: 'sequence',
    steps: [
      // レベル7以下のキャラを1枚まで選び、リムーブする
      { kind: 'atom', verb: 'sceneRemove', args: { uid: '$pick', target: { kind: 'pick', query: { area: 'scene', side: 'either', filter: { levelMax: 7 } }, n: { min: 0, max: 1 }, chooser: 'self' } } },
      // 自分の現場にいるキャラを1枚まで選び、ターン終了時まで〚突撃［事件］〛を与える
      { kind: 'atom', verb: 'charGrantKeyword', args: { uid: '$pick', kw: '突撃[事件]', scope: 'turn', target: { kind: 'pick', query: { area: 'scene', side: 'self' }, n: { min: 0, max: 1 }, chooser: 'self' } } },
    ],
  },
  description:
    '【パートナー赤】レベル7以下のキャラを1枚までリムーブ。自分の現場のキャラを1枚までターン終了まで〚突撃［事件］〛付与。',
  ruleRefs: ['rules/07-action-flow.md', 'rules/13-keywords.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

export const PR156: CardDef = {
  id: 'PR156',
  no: '0625/PR156',
  kind: 'event',
  names: ['「もう少し引き付けろ…」'],
  colors: ['赤'],
  level: 7,
  traits: [],
  rarity: 'PR',
  imageUrl: '1753704129523810.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/07-action-flow.md',
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/20-color-and-switch.md',
  ],
};
