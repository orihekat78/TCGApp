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

// a2: 【ヒラメキ】カードを1枚引く (BUG-140 補修 2026-06-13: TSV hirameki 列の取りこぼし修正) — D03011 a2 同型
const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-evidence',
  trigger: { hook: 'evidence:remove-by-action', optional: true },
  // カードを1枚引く
  effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
  description: '【ヒラメキ】（証拠からリムーブされるときに発動する）カードを1枚引く。',
  ruleRefs: ['rules/10-action-event.md', 'rules/14-refresh.md'],
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
  abilities: [a1, a2],
  ruleRefs: ['rules/03-field-areas.md', 'rules/15-abilities-effects.md', 'rules/24-qa-naming-stun.md'],
};
