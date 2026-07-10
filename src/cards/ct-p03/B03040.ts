// cards/ct-p03/B03040 和田進一 (character) — engine additive A2 exemplar (peekOwnEvidence, 2026-07-11)
// rules: 11-reasoning.md, 10-action-event.md, 15-abilities-effects.md, 17-icons.md
//
// 公式テキスト:
//   【自分ターン中】【ターン1】自分が証拠を得たとき、自分の証拠を上から1つ見る。（裏向きの証拠を見た場合、その後、元に戻す）
//   【カットイン】AP＋1000（コンタクト中に手札からリムーブして使う）
// 公式Q&A:
//   - 証拠を2つ以上同時に得たとき → 得る処理が終わってから発動、その時点で1番上の証拠を見る。
//   - 1番上が表向きの場合、2つ目以降の裏向き証拠を見ることはできない (常に「上から1つ」だけ)。
//
// 句マッピング:
//   a1 = 「自分が証拠を得たとき」を汎用に拾う multi-hook trigger ['evidence:gain','reasoning:end']
//        (action[事件]獲得 = evidence:gain / 推理獲得 = reasoning:end。両 payload とも player を持つため
//         matcherCondition triggerPlayerIs{side:'self'} で自分の獲得に限定。両 hook は排他発火 = 二重不発)
//        + condition turn:self (【自分ターン中】) + limit turn:1 (【ターン1】)
//        → peekOwnEvidence{player:'self'} (本 wave 新 atom、自証拠 top1 を private 閲覧、zone/faceUp 不変)。
//   a2 = 【カットイン】AP＋1000 (D01009 a1 同型、$contact.byUid を contact scope で +1000)。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: {
    hook: 'evidence:gain',
    hooks: ['reasoning:end'], // 推理由来の獲得も拾う (reasoning は evidence:gain を emit しないため並記)
    matcherCondition: { kind: 'triggerPlayerIs', side: 'self' },
  },
  condition: { kind: 'turn', player: 'self' }, // 【自分ターン中】
  limit: { kind: 'turn', n: 1 }, // 【ターン1】
  effect: { kind: 'atom', verb: 'peekOwnEvidence', args: { player: 'self' } },
  description:
    '【自分ターン中】【ターン1】自分が証拠を得たとき、自分の証拠を上から1つ見る。（裏向きの証拠を見た場合、その後、元に戻す）',
  ruleRefs: ['rules/10-action-event.md', 'rules/11-reasoning.md', 'rules/17-icons.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-hand',
  trigger: { hook: 'effect:declared', optional: true, selfOnly: true }, // 【カットイン】(コンタクト中に手札から使用)
  effect: { kind: 'atom', verb: 'charModifyAP', args: { uid: '$contact.byUid', delta: 1000, scope: 'contact' } },
  description: '【カットイン】AP＋1000（コンタクト中に手札からリムーブして使う）',
  ruleRefs: ['rules/09-cutin-disguise.md', 'rules/22-qa-action-contact.md'],
};

export const B03040: CardDef = {
  id: 'B03040',
  no: '0297/B03040',
  kind: 'character',
  names: ['和田進一'],
  colors: ['緑'],
  level: 2,
  ap: 1000,
  lp: 1,
  traits: ['執事', '医療関係者'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1729133249347236.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/09-cutin-disguise.md',
    'rules/10-action-event.md',
    'rules/11-reasoning.md',
    'rules/17-icons.md',
  ],
};
