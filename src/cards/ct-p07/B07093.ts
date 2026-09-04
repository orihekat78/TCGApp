// cards/ct-p07/B07093 バーボン＆ライ (キャラ MR) — printed a1/a2 + cut-in
// rules: 03-field-areas.md, 05-turn-phases.md, 13-keywords.md, 15-abilities-effects.md,
// 17-icons.md, 18-mr.md, 19-special-rules.md, 20-color-and-switch.md,
// 21-declared-ability-cost.md, 23-qa-disguise-cutin.md
//
// 公式テキスト:
//   【パートナー黒】【FILE7】【宣言】【ターン1】手札からレベル4以下の〚特徴［黒ずくめの組織］〛のキャラを
//     1枚まで登場させるか、自分のリムーブエリアにあるレベル4以下の〚特徴［黒ずくめの組織］〛のキャラを
//     1枚まで選び、登場させる。ターン終了時までそのキャラをAP＋4000し、〚突撃〛と「ターン終了時、
//     このキャラを現場からデッキの下に移す。」を与える。
//   【宣言】【ターン1】相手の現場にいるキャラを1枚まで選び、ターン終了時までレベル－1する。
//     この能力はパートナーエリアでも宣言できる。
//
// a2: declared + turn1 limit + 相手 1pick で turn-level-1 (B05066/B07103 a2 同型)

import type { AbilityDef, CardDef } from '@/engine/types';

// Compatibility: append a1 after the already-shipped a2/a3 occurrences.
// Their physical indices remain 0/1 for old saves and V1/V2 replay moves.
const a1: AbilityDef = {
  id: 'a1',
  type: 'declared',
  scope: 'on-scene',
  condition: {
    kind: 'and',
    cs: [
      { kind: 'partnerColor', color: '黒' },
      { kind: 'fileAtLeast', n: 7 },
    ],
  },
  limit: { kind: 'turn', n: 1 },
  effect: {
    kind: 'choice',
    chooser: 'self',
    options: [
      {
        kind: 'sequence',
        steps: [
          {
            kind: 'atom',
            verb: 'sceneEnter',
            args: {
              player: 'self',
              cardId: '$pick.cardId',
              from: 'hand',
              viaEffect: true,
              bind: '$matched',
              target: {
                kind: 'pick',
                query: {
                  area: 'hand',
                  side: 'self',
                  filter: { trait: '黒ずくめの組織', levelMax: 4, kind: 'character' },
                },
                n: { min: 0, max: 1 },
                chooser: 'self',
              },
            },
          },
          { kind: 'atom', verb: 'charModifyAP', args: { uid: '$matched.uid', delta: 4000, scope: 'turn' } },
          { kind: 'atom', verb: 'charGrantKeyword', args: { uid: '$matched.uid', kw: '突撃', scope: 'turn' } },
          { kind: 'atom', verb: 'charSetTurnEffect', args: { uid: '$matched.uid', key: 'toDeckBottomOnTurnEnd', val: true } },
        ],
      },
      {
        kind: 'sequence',
        steps: [
          {
            kind: 'atom',
            verb: 'sceneEnter',
            args: {
              player: 'self',
              cardId: '$pick.cardId',
              from: 'remove',
              viaEffect: true,
              bind: '$matched',
              target: {
                kind: 'pick',
                query: {
                  area: 'remove',
                  side: 'self',
                  filter: { trait: '黒ずくめの組織', levelMax: 4, kind: 'character' },
                },
                n: { min: 0, max: 1 },
                chooser: 'self',
              },
            },
          },
          { kind: 'atom', verb: 'charModifyAP', args: { uid: '$matched.uid', delta: 4000, scope: 'turn' } },
          { kind: 'atom', verb: 'charGrantKeyword', args: { uid: '$matched.uid', kw: '突撃', scope: 'turn' } },
          { kind: 'atom', verb: 'charSetTurnEffect', args: { uid: '$matched.uid', key: 'toDeckBottomOnTurnEnd', val: true } },
        ],
      },
    ],
  },
  description:
    '【パートナー黒】【FILE7】【宣言】【ターン1】手札からレベル4以下の〚特徴［黒ずくめの組織］〛のキャラを1枚まで登場させるか、自分のリムーブエリアにあるレベル4以下の〚特徴［黒ずくめの組織］〛のキャラを1枚まで選び、登場させる。ターン終了時までそのキャラをAP＋4000し、〚突撃〛と「ターン終了時、このキャラを現場からデッキの下に移す。」を与える。',
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/05-turn-phases.md',
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/20-color-and-switch.md',
    'rules/21-declared-ability-cost.md',
    'rules/23-qa-disguise-cutin.md',
  ],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'declared',
  scope: 'on-partner-area', // M3 PA batch (2026-07-10): 「この能力はパートナーエリアでも宣言できる」(rules/18)
  limit: { kind: 'turn', n: 1 },
  effect: {
    kind: 'atom',
    verb: 'charModifyLevel',
    args: { player: 'self', max: 1, side: 'opp', delta: -1, scope: 'turn' },
  },
  description: '【宣言】【ターン1】相手の現場のキャラを1枚までレベル-1 (ターン終了時まで)。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/21-declared-ability-cost.md'],
};

// a3: 【カットイン】AP＋2000 (BUG-140 補修 2026-06-13: TSV cutIn 列の取りこぼし修正) — D08015 a2 同型
const a3: AbilityDef = {
  id: 'a3',
  type: 'triggered',
  scope: 'on-hand',
  trigger: { hook: 'effect:declared', optional: true, selfOnly: true }, // 【カットイン】(コンタクト中に手札から使用)
  effect: { kind: 'atom', verb: 'charModifyAP', args: { uid: '$contact.byUid', delta: 2000, scope: 'contact' } },
  description: '【カットイン】AP＋2000',
  ruleRefs: ['rules/09-cutin-disguise.md', 'rules/22-qa-action-contact.md'],
};

export const B07093: CardDef = {
  id: 'B07093',
  no: '0820/B07093',
  kind: 'character',
  names: ['バーボン＆ライ', 'バーボン', 'ライ'],
  colors: ['黒'],
  level: 9, ap: 8000, lp: 2,
  traits: ['黒ずくめの組織'], keywords: [],
  rarity: 'MR',
  imageUrl: '1758249671523142.jpg',
  abilities: [a2, a3, a1], // printed order differs intentionally; physical occurrence identity is stable
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/18-mr.md', 'rules/19-special-rules.md'],
};
