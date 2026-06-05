// cards/ct-p06/B06071 「閃光弾!?」 (イベント) — catalog-reuse batch
// rules: 03-field-areas.md, 15-abilities-effects.md, 24-qa-naming-stun.md
//
// 公式テキスト:
//   自分と相手の現場にいるスリープ状態のすべてのキャラをスタンさせる。
//   （スタン状態のキャラをアクティブにする場合、代わりにスリープさせる）
//
// a1: イベント使用 (effect:declared selfOnly, matcher kind:'event-use' — D11020 同型) →
//     「すべて」=プレイヤー選択無し → forEach over:{kind:'all'}(両者現場のスリープ) で sceneSetState(stun)。
//     ($each.uid 形 — tests/engine/effect/foreach-all.test.ts で primitive 検証済)。
//     スタン特殊挙動「アクティブ化→代わりにスリープ」は engine の stun 機構が担保 (rules/03, 24)。

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
  // 自分と相手の現場にいるスリープ状態のすべてのキャラをスタンさせる
  effect: {
    kind: 'forEach',
    over: { kind: 'all', query: { area: 'scene', side: 'either', state: ['sleep'] } },
    do: { kind: 'atom', verb: 'sceneSetState', args: { uid: '$each.uid', state: 'stun' } },
  },
  description: '自分と相手の現場のスリープ状態のすべてのキャラをスタンさせる。',
  ruleRefs: ['rules/03-field-areas.md', 'rules/15-abilities-effects.md', 'rules/24-qa-naming-stun.md'],
};

export const B06071: CardDef = {
  id: 'B06071',
  no: '0692/B06071',
  kind: 'event',
  names: ['「閃光弾!?」'],
  colors: ['白'],
  level: 7,
  traits: [],
  rarity: 'C',
  imageUrl: '1754285244524143.jpg',
  abilities: [a1],
  ruleRefs: ['rules/03-field-areas.md', 'rules/15-abilities-effects.md', 'rules/24-qa-naming-stun.md'],
};
