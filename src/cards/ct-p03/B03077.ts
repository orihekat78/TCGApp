// cards/ct-p03/B03077 水無怜奈 (キャラ) — evidence-top→hand micro-cluster (2026-06-21)
// rules: 01-victory-conditions.md (§証拠), 06-card-types.md (§証拠化), 10-action-event.md (§ヒラメキ),
//        14-refresh.md (§draw), 15-abilities-effects.md (§「〜してもよい。そうした場合」), 17-icons.md (§【登場時】)
//
// 公式テキスト:
//   【登場時】自分の証拠を上から1つ手札に加えてもよい。そうした場合、手札からカードを1枚裏向きで証拠として得る。
//   【ヒラメキ】（証拠からリムーブされるときに発動する）カードを1枚引く。
//
// 公式Q&A (ct-p03 TSV): Q「証拠から手札に加えたカードをそのまま証拠として得ることはできますか？」A「はい、可能です。」
//   → step2 handToEvidence は手札全体 (= step1 で加えたカードを含む) から pick。特別処理不要。
//
// a1: 【登場時】(enter selfOnly)。「〜してもよい。そうした場合〜」= optional{chain[...]} (exemplar D09010 a1 =
//     optional{chain[discard, evidenceGain]} VERBATIM twin)。optional = 「してもよい」(yes/no、deterministic top
//     のため pick-0 で decline できず optional wrapper が decline 経路)。chain = 「そうした場合」success gate
//     (step1 が証拠0 で no-op → __chainStepNoApply → step2 break)。
//     step1 = evidenceToHand fromTop (「証拠を上から1つ」= deterministic 最上、engine拡張 wave 2026-06-21、
//     filePopToHand と同型の chain-break)。B06029 a1 は「1つ選び」= 自由 pick (max:1) だが本カードは「上から」固定。
//     step2 = handToEvidence n:1 (手札1枚を裏向き証拠、する=必須 rules/15)。
// a2: 【ヒラメキ】evidence:remove-by-action optional → カードを1枚引く (exemplar D01003 a2 VERBATIM twin)。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  // 【登場時】
  trigger: { hook: 'enter', selfOnly: true },
  effect: {
    kind: 'optional', // 〜してもよい
    effect: {
      kind: 'chain', // そうした場合 (step1 no-op → step2 break)
      steps: [
        // 自分の証拠を上から1つ手札に加え (fromTop = deterministic 最上)
        { kind: 'atom', verb: 'evidenceToHand', args: { player: 'self', fromTop: true } },
        // そうした場合、手札からカードを1枚裏向きで証拠として得る (する=n:1)
        { kind: 'atom', verb: 'handToEvidence', args: { player: 'self', n: 1 } },
      ],
    },
  },
  description: '【登場時】自分の証拠を上から1つ手札に加えてもよい。そうした場合、手札から1枚を裏向きで証拠として得る。',
  ruleRefs: ['rules/01-victory-conditions.md', 'rules/06-card-types.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-evidence',
  // 【ヒラメキ】証拠が action[事件] でリムーブされたとき (任意発動)
  trigger: { hook: 'evidence:remove-by-action', optional: true },
  // カードを1枚引く
  effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
  description: '【ヒラメキ】（証拠からリムーブされるときに発動する）カードを1枚引く。',
  ruleRefs: ['rules/10-action-event.md', 'rules/14-refresh.md'],
};

export const B03077: CardDef = {
  id: 'B03077',
  no: '0331/B03077',
  kind: 'character',
  names: ['水無怜奈'],
  colors: ['赤'],
  level: 4,
  ap: 4000,
  lp: 1,
  traits: ['アナウンサー'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1729133424878967.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/01-victory-conditions.md',
    'rules/06-card-types.md',
    'rules/10-action-event.md',
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
  ],
};
