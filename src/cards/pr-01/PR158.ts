// cards/pr-01/PR158 犯人 (キャラ)
// rules: 02-deck-construction.md, 09-cutin-disguise.md, 15-abilities-effects.md, 17-icons.md, 22-qa-action-contact.md
// spec: engine additive wave A2 (2026-07-02) — $self.removeNameCount dyn exemplar
//
// 公式テキスト:
//   犯人［ID：0627］はデッキに何枚でも入れることができる。
//   【カットイン】【自分ターン中】自分のリムーブエリアにある〚カード名［犯人］〛1枚につき、AP＋2000（このカードも含める）
//
// 「デッキに何枚でも入れられる」はデッキ構築時のルール (rules/02) でありゲーム中の hook ではない (公式Q&A:
//   「元の能力を無効にされても、デッキ構築のルールにのみ影響するためゲーム上は何も起こらない」)。→ AbilityDef 非表現。
// a1: カットイン。$self.removeNameCount.犯人 = ctx.source.player のリムーブエリアの犯人枚数 (分割名一致、rules/19)。
//   「（このカードも含める）」= カットイン自身は resolve 時点で既に remove 内 (flow/contact.ts の
//   effect:declared emit → discardToRemove → resolve.runAllUntilEmpty の遅延解決順) のため自然に計数される。
//   D08007 吉田歩美 ($self.sceneTrait dyn カットイン) と同型。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-hand',
  trigger: { hook: 'effect:declared', optional: true, selfOnly: true },
  condition: { kind: 'turn', player: 'self' }, // 【自分ターン中】
  // リムーブエリアの犯人1枚につき、コンタクト中の攻撃キャラを AP＋2000 (自身も remove 内なので計数される)
  effect: { kind: 'atom', verb: 'charModifyAP', args: { uid: '$contact.byUid', delta: { dyn: '$self.removeNameCount.犯人 * 2000' }, scope: 'contact' } },
  description:
    '【カットイン】【自分ターン中】自分のリムーブエリアにある[犯人]1枚につき、AP＋2000（このカードも含める）。',
  ruleRefs: ['rules/09-cutin-disguise.md', 'rules/22-qa-action-contact.md'],
};

export const PR158: CardDef = {
  id: 'PR158',
  no: '0627/PR158',
  kind: 'character',
  names: ['犯人'],
  colors: ['黒'],
  level: 2,
  ap: 1000,
  lp: 1,
  traits: ['犯人'],
  keywords: [],
  rarity: 'PR',
  imageUrl: '1753704129533219.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/02-deck-construction.md',
    'rules/09-cutin-disguise.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/22-qa-action-contact.md',
  ],
};
