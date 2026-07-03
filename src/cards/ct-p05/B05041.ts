// cards/ct-p05/B05041 「オレのそばから離れんなや…」 (event) — engine mega-wave W4 r1 exemplar (protection rider, 2026-07-03)
// rules: 08-contact.md (コンタクト除去は貫通), 10-action-event.md (ヒラメキ), 15-abilities-effects.md,
//        16-card-set.md (セット/表向き), 19-special-rules.md
//
// 公式テキスト:
//   このイベントを自分の現場にいる【緑】のキャラ1枚にセットする。
//   このイベントがセットされているキャラは、相手の能力や効果によってリムーブされず、スリープされず、
//   スタンされない。
//   【ヒラメキ】（証拠からリムーブされるときに発動する）このカードを手札に加える。
//
// a1: 使用イベント自身を host にセット = charSetCard fromSelf (2026-06-29d 出荷、表向きセット)。
//     「キャラ1枚に」= n:1 必須 (host 0 なら不発でイベントは使用済 = B01023 裁定と同型)。
// a2: 保護 rider (W4 r1) = scope 'on-set-host' continuous + opponentRestrict['remove','sleep','stun']。
//     読取 = read.char.charProtectedFrom (faceUp setCards walk)、gate = atomSceneRemove/atomSceneSetState
//     の相手発 effect のみ。公式Q&A: 選ぶことは妨げない / コンタクトによるリムーブは妨げない /
//     リムーブ・スリープ・スタン以外の効果 (デッキの下に移す等) は妨げない — narrow-gate で全て自然成立。
//     ★解釈 (W4 混成 review → fable 裁定): 相手の「アクティブにする」効果を保護中の **スタン状態** キャラが
//     受けた場合、rules/03 の代替 (代わりにスリープ) は貫通する — 保護が列挙するのは「スリープさせる効果」
//     等の効果種別であり、activate 効果はそれに該当しない (Q&A の効果種別列挙に整合)。公式裁定が出たら反転可。
// a3: ヒラメキ self-to-hand (B03088 同型)。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-hand',
  // イベント自己使用トリガ (B02033/B02053 同型 event-use idiom)
  trigger: {
    hook: 'effect:declared',
    selfOnly: true,
    matcher: (p: unknown) => (p as { kind?: unknown })?.kind === 'event-use',
  },
  // このイベントを自分の現場にいる【緑】のキャラ1枚にセットする (fromSelf = 表向きセット)
  effect: { kind: 'atom', verb: 'charSetCard', args: { player: 'self', fromSelf: true, n: 1, filter: { color: '緑', kind: 'character' } } },
  description: 'このイベントを自分の現場にいる【緑】のキャラ1枚にセットする。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/16-card-set.md'],
};

// このイベントがセットされているキャラは、相手の能力や効果によってリムーブされず、スリープされず、スタンされない
const a2: AbilityDef = {
  id: 'a2',
  type: 'continuous',
  scope: 'on-set-host',
  continuousModifier: { opponentRestrict: ['remove', 'sleep', 'stun'] },
  description: 'このイベントがセットされているキャラは、相手の能力や効果によってリムーブされず、スリープされず、スタンされない。',
  ruleRefs: ['rules/08-contact.md', 'rules/16-card-set.md', 'rules/19-special-rules.md'],
};

const a3: AbilityDef = {
  id: 'a3',
  type: 'triggered',
  scope: 'on-evidence',
  trigger: { hook: 'evidence:remove-by-action', optional: true },
  effect: { kind: 'atom', verb: 'handAddFromRemove', args: { player: 'self', fromSelf: true } },
  description: '【ヒラメキ】（証拠からリムーブされるときに発動する）このカードを手札に加える。',
  ruleRefs: ['rules/10-action-event.md', 'rules/14-refresh.md'],
};

export const B05041: CardDef = {
  id: 'B05041',
  no: '0545/B05041',
  kind: 'event',
  names: ['「オレのそばから離れんなや…」'],
  colors: ['緑'],
  level: 8,
  traits: [],
  keywords: [],
  rarity: 'C',
  imageUrl: '1746628061768441.jpg',
  abilities: [a1, a2, a3],
  ruleRefs: ['rules/16-card-set.md', 'rules/19-special-rules.md'],
};
