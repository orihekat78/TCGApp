// cards/pr-01/PR164 犯人 (キャラ) — PR158 と同一テキスト・別アート (ID 0627)
// rules: 02-deck-construction.md, 09-cutin-disguise.md, 15-abilities-effects.md, 17-icons.md, 22-qa-action-contact.md
// spec: engine additive wave A2 (2026-07-02) — $self.removeNameCount dyn exemplar
//
// 公式テキスト:
//   犯人［ID：0627］はデッキに何枚でも入れることができる。
//   【カットイン】【自分ターン中】自分のリムーブエリアにある〚カード名［犯人］〛1枚につき、AP＋2000（このカードも含める）
//
// PR158 と同一 (別アート printing)。詳細は PR158.ts のコメント参照。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-hand',
  trigger: { hook: 'effect:declared', optional: true, selfOnly: true },
  condition: { kind: 'turn', player: 'self' }, // 【自分ターン中】
  effect: { kind: 'atom', verb: 'charModifyAP', args: { uid: '$contact.byUid', delta: { dyn: '$self.removeNameCount.犯人 * 2000' }, scope: 'contact' } },
  description:
    '【カットイン】【自分ターン中】自分のリムーブエリアにある[犯人]1枚につき、AP＋2000（このカードも含める）。',
  ruleRefs: ['rules/09-cutin-disguise.md', 'rules/22-qa-action-contact.md'],
};

export const PR164: CardDef = {
  id: 'PR164',
  no: '0627/PR164',
  kind: 'character',
  names: ['犯人'],
  colors: ['黒'],
  level: 2,
  ap: 1000,
  lp: 1,
  traits: ['犯人'],
  keywords: [],
  rarity: 'PR',
  imageUrl: '1753704129566203.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/02-deck-construction.md',
    'rules/09-cutin-disguise.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/22-qa-action-contact.md',
  ],
};
