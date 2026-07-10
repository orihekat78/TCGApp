// cards/ct-p03/B03008 阿笠博士 (character) — engine additive A2 exemplar (state:change active→sleep, 2026-07-11)
// rules: 03-field-areas.md, 11-reasoning.md, 15-abilities-effects.md, 17-icons.md, 24-qa-naming-stun.md
//
// 公式テキスト:
//   【自分ターン中】【ターン1】自分の現場にいるアクティブ状態の〚特徴［少年探偵団］〛のキャラが
//     スリープ状態になったとき、カードを1枚引き、手札を1枚リムーブする。
//   【ヒラメキ】（証拠からリムーブされるときに発動する）カードを1枚引く。
// 公式Q&A:
//   - 推理/アクションでスリープしたときも発動 (宣言しスリープさせた時点で、ミスリード/ガード決定より前に解決)。
//   - 発動したら「1枚引き1枚リムーブ」を解決しないことは選択できない (必須効果、sequence)。
//   - 【宣言】コストの【スリープ】でスリープした場合 → 【宣言】能力の効果を先に解決 (未解決順は本 wave 非依存)。
//
// 句マッピング:
//   a1 = 「アクティブ状態の〚少年探偵団〛がスリープになったとき」= 本 wave 新 hook state:change
//        (mutate/scene.ts setState が active→sleep 実遷移時のみ emit。「アクティブ状態の」= from==='active'
//         は emit gate で構造保証済) + matcherCondition triggerCharMatches{payloadKey:'uid', side:'self',
//         filter:{trait:'少年探偵団'}} (遷移キャラ=payload.uid が自分側の少年探偵団) + condition turn:self
//        (【自分ターン中】) + limit turn:1 (【ターン1】) → sequence[draw1, discard1]。
//   a2 = 【ヒラメキ】evidence:remove-by-action optional → draw1。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: {
    hook: 'state:change',
    matcherCondition: {
      kind: 'triggerCharMatches',
      payloadKey: 'uid',
      side: 'self',
      filter: { trait: '少年探偵団' },
    },
  },
  condition: { kind: 'turn', player: 'self' }, // 【自分ターン中】
  limit: { kind: 'turn', n: 1 }, // 【ターン1】
  effect: {
    kind: 'sequence',
    steps: [
      { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
      { kind: 'atom', verb: 'discard', args: { player: 'self', n: 1 } }, // 手札を1枚リムーブする
    ],
  },
  description:
    '【自分ターン中】【ターン1】自分の現場にいるアクティブ状態の〚特徴［少年探偵団］〛のキャラがスリープ状態になったとき、カードを1枚引き、手札を1枚リムーブする。',
  ruleRefs: ['rules/03-field-areas.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/24-qa-naming-stun.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-evidence',
  trigger: { hook: 'evidence:remove-by-action', optional: true }, // 【ヒラメキ】任意発動
  effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
  description: '【ヒラメキ】（証拠からリムーブされるときに発動する）カードを1枚引く。',
  ruleRefs: ['rules/10-action-event.md'],
};

export const B03008: CardDef = {
  id: 'B03008',
  no: '0266/B03008',
  kind: 'character',
  names: ['阿笠博士'],
  colors: ['青'],
  level: 6,
  ap: 5000,
  lp: 1,
  traits: ['発明家'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1729133048277394.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/10-action-event.md',
    'rules/11-reasoning.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/24-qa-naming-stun.md',
  ],
};
