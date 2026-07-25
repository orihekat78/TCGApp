// cards/ct-p02/B02032 「立てや坂田ァ!!」 (イベント) — catalog-reuse batch
// rules: 03-field-areas.md, 15-abilities-effects.md, 17-icons.md, 19-special-rules.md
//
// 公式テキスト:
//   このイベントは自分の事件が解決編で、自分の現場に〚カード名［服部平次］〛がいる場合に使用できる。
//   相手の現場にいるすべてのキャラをスリープさせる。
//
// a1: Usage authorization belongs exclusively to CardDef.useCondition.
//     イベント使用 (effect:declared selfOnly, matcher kind:'event-use' — D11020 同型)。
//     「すべて」=プレイヤー選択無し → forEach over:{kind:'all'}(相手現場) で sceneSetState(sleep)。
//     ($each.uid 形 — tests/engine/effect/foreach-all.test.ts で primitive 検証済)。

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
  // 相手の現場にいるすべてのキャラをスリープさせる
  effect: {
    kind: 'forEach',
    over: { kind: 'all', query: { area: 'scene', side: 'opp' } },
    do: { kind: 'atom', verb: 'sceneSetState', args: { uid: '$each.uid', state: 'sleep' } },
  },
  description: '【解決編・絆服部平次】相手の現場のすべてのキャラをスリープさせる。',
  ruleRefs: ['rules/03-field-areas.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

export const B02032: CardDef = {
  id: 'B02032',
  no: '0202/B02032',
  kind: 'event',
  names: ['「立てや坂田ァ!!」'],
  colors: ['緑'],
  level: 5,
  traits: [],
  rarity: 'C',
  imageUrl: '1721357211034778.jpg',
  useCondition: { kind: 'and', cs: [{ kind: 'caseStatus', status: '解決編' }, { kind: 'bond', cardName: '服部平次' }] },
  abilities: [a1],
  ruleRefs: ['rules/03-field-areas.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/19-special-rules.md'],
};
