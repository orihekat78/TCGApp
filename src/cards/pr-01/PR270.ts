// cards/pr-01/PR270 宮野明美 (パラレル) — PR264 と同型 (絵柄違い・テキスト同一)。engine変更0 wave (2026-06-28)
// rules: rules/07-action-flow.md, rules/11-reasoning.md, rules/13-keywords.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/19-special-rules.md

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'continuous',
  scope: 'on-scene',
  condition: { kind: 'caseStatus', status: '解決編' },
  continuousModifier: { lvlDelta: 2 },
  description: '【解決編】現場にいるこのキャラをレベル＋2する。',
  ruleRefs: ['rules/11-reasoning.md', 'rules/17-icons.md', 'rules/19-special-rules.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'enter', selfOnly: true },
  effect: {
    kind: 'conditional',
    if: { kind: 'sceneHas', query: { area: 'scene', side: 'self', filter: { levelMin: 7, levelMax: 7 } }, nMin: 3 },
    then: { kind: 'atom', verb: 'charGrantKeyword', args: { uid: '$self', kw: '突撃[事件]', scope: 'turn' } },
  },
  description: '【登場時】自分の現場にレベル7のキャラが3枚以上いる場合、ターン終了時までこのキャラは〚突撃［事件］〛を持つ。',
  ruleRefs: ['rules/07-action-flow.md', 'rules/13-keywords.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

export const PR270: CardDef = {
  id: 'PR270',
  no: '1055/PR270',
  kind: 'character',
  names: ['宮野明美'],
  colors: ['赤'],
  level: 5, ap: 5000, lp: 1,
  traits: [], keywords: ['突撃[キャラ]'],
  rarity: 'PR',
  imageUrl: '1774884005696453.jpg',
  abilities: [a1, a2],
  ruleRefs: ['rules/07-action-flow.md', 'rules/11-reasoning.md', 'rules/13-keywords.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/19-special-rules.md'],
};
