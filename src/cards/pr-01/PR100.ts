// cards/pr-01/PR100 宮野厚司 (キャラ) — Task D batch (2026-06-12)
// rules: 05-turn-phases.md, 09-cutin-disguise.md, 10-action-event.md, 14-refresh.md, 15-abilities-effects.md, 17-icons.md
//
// 公式テキスト:
//   【カットイン】【解決編】【FILE4】自分のFILEエリアにあるカードを上から1枚手札に加えてもよい。
//     そうした場合、自分のリムーブエリアにあるレベル5以下の〚カード名［シェリー］〛か〚［宮野志保］〛か
//     〚［宮野明美］〛のキャラを1枚まで選び、現場に登場させる。
//   【ヒラメキ】（証拠からリムーブされるときに発動する）カードを1枚引く。
//
// a1: 【カットイン】 = effect:declared on-hand (PR087/B05110 同型)。【解決編】【FILE4】= condition and[caseStatus, fileAtLeast]
//     — rules/17 Point + 公式Q&A「事件編でも使うことはできますが、何も起こりません」(canCutIn は condition を見ない vacuous 使用)。
//     【FILE4】はアシストパートナー込み (公式Q&A / cond/eval.ts fileAtLeast = file.length)。
//     「加えてもよい。そうした場合」= optional{chain}: step1 filePopToHand (アシストパートナーは popTop が自動除外、
//     FILE 0枚なら __chainStepNoApply → chain break — 公式Q&A「実行できない場合、それ以降の効果は解決できません」) /
//     step2 sceneEnter from remove — filterAny 3名 (rules/19 分割名 match) × 各 levelMax5 (公式Q&A「選ぶキャラはレベル5以下」)、
//     1枚まで = max:1 (0枚 skip 可)、効果による登場 = viaEffect (色制限なし rules/20)。D08024 a1 同型。
// a2: 【ヒラメキ】 evidence:remove-by-action で1ドロー — D08013/B02061 a2 同型

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-hand',
  trigger: { hook: 'effect:declared', optional: true, selfOnly: true }, // 【カットイン】(コンタクト中に手札から使用)
  // 【解決編】【FILE4】(rules/17 Point: 未満なら能力を持たない扱い — 使用は可だが何も起こらない)
  condition: { kind: 'and', cs: [{ kind: 'caseStatus', status: '解決編' }, { kind: 'fileAtLeast', n: 4 }] },
  effect: {
    kind: 'optional',
    effect: {
      kind: 'chain',
      steps: [
        // 自分のFILEエリアにあるカードを上から1枚手札に加えてもよい (0枚なら以降解決不可 = chain break / パートナー除外)
        { kind: 'atom', verb: 'filePopToHand', args: { player: 'self' } },
        // そうした場合、自分のリムーブエリアにあるレベル5以下の[シェリー]か[宮野志保]か[宮野明美]のキャラを1枚まで選び、現場に登場させる
        { kind: 'atom', verb: 'sceneEnter', args: { player: 'self', from: 'remove', max: 1, viaEffect: true, filterAny: [{ cardName: 'シェリー', levelMax: 5 }, { cardName: '宮野志保', levelMax: 5 }, { cardName: '宮野明美', levelMax: 5 }] } },
      ],
    },
  },
  description:
    '【カットイン】【解決編】【FILE4】自分のFILEエリアにあるカードを上から1枚手札に加えてもよい。そうした場合、自分のリムーブエリアにあるレベル5以下の〚カード名［シェリー］〛か〚［宮野志保］〛か〚［宮野明美］〛のキャラを1枚まで選び、現場に登場させる。',
  ruleRefs: ['rules/09-cutin-disguise.md', 'rules/17-icons.md', 'rules/05-turn-phases.md', 'rules/15-abilities-effects.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-evidence',
  trigger: { hook: 'evidence:remove-by-action', optional: true },
  // カードを1枚引く
  effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
  description: '【ヒラメキ】カードを1枚引く。',
  ruleRefs: ['rules/10-action-event.md', 'rules/14-refresh.md'],
};

export const PR100: CardDef = {
  id: 'PR100',
  no: '0487/PR100',
  kind: 'character',
  names: ['宮野厚司'],
  colors: ['赤'],
  level: 6,
  ap: 5000,
  lp: 1,
  traits: ['科学者', '医師'],
  keywords: [],
  rarity: 'PR',
  imageUrl: '195c366784a99.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/05-turn-phases.md',
    'rules/09-cutin-disguise.md',
    'rules/10-action-event.md',
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
  ],
};
