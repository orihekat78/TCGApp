// cards/ct-p08/B08028 日向幸 (character) — engine mega-wave W5 exemplar (r38 evidenceFlip mirror-count bind, 2026-07-03)
// rules: 03-field-areas.md, 10-action-event.md, 15-abilities-effects.md, 17-icons.md,
//        21-declared-ability-cost.md
//
// 公式テキスト:
//   【宣言】【スリープ】〚このキャラ以外のキャラを1枚リムーブエリアに移す〛：自分の裏向きの証拠を
//     好きな数選び、表向きにする。この効果によって表向きにした枚数と同じ数まで相手の裏向きの証拠を
//     選び、表向きにする。
//   【ヒラメキ】（証拠からリムーブされるときに発動する）カードを1枚引く。
//
// 句マッピング:
//   a1: 【宣言】=> type:'declared' / 【スリープ】=> cost item {kind:'sleepSelf'}。
//       〚このキャラ以外のキャラを1枚リムーブエリアに移す〛(「:」左=コスト rules/21) =>
//         cost item {kind:'removeFromScene', target:{kind:'pick', query:{area:'scene', side:'self',
//         excludeSelf:true}, n:{min:1,max:1}, chooser:'self'}, n:1} (B03067 a3 同型)。
//         side:'self' = 公式Q&A「コストでは自分のカードしか使えない (自分の現場のキャラ)」。
//         excludeSelf:true = 「このキャラ以外」。
//       「自分の裏向きの証拠を好きな数選び、表向きにする」=> sequence step1
//         evidenceFlip{player:'self', cardIds:'$pick.cardIds', max:99, faceDown:true, bind:'$flipped'}
//         (multi-pick cardIds 契約 = B05013 evidenceFlipDown 同型の faceUp 版。max:99 = 「好きな数」、
//          候補=裏向き自証拠で自然 cap。公式Q&A「1枚ずつではなく選んでから表向き」= 一括 pick と一致。
//          公式Q&A「どの順番のカードでも選べる」= pick 候補は位置無制限と一致)。
//       「この効果によって表向きにした枚数と同じ数まで相手の裏向きの証拠を選び、表向きにする」=>
//         sequence step2 evidenceFlip{player:'opp', cardIds:'$pick.cardIds',
//         max:{dyn:'$bound.$flipped.count'}, faceDown:true} (mega-wave W5 r38: dyn-max は
//         atomEvidenceFlip が dispatch 時に literalize。「同じ数まで」= min:0 で 0枚可 rules/15。
//         step1 0枚なら max 0 → no-op)。
//   a2: 【ヒラメキ】カードを1枚引く => triggered on-evidence + evidence:remove-by-action optional
//       + draw1 (D01003/B09072 a3 VERBATIM)。
//   [cutIn col] 空 / [henso col] 空 → 未カバー句なし。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'declared',
  scope: 'on-scene',
  // 【スリープ】+〚このキャラ以外のキャラを1枚リムーブエリアに移す〛(全て行う rules/21)
  cost: {
    kind: 'pay',
    items: [
      { kind: 'sleepSelf' },
      { kind: 'removeFromScene', target: { kind: 'pick', query: { area: 'scene', side: 'self', excludeSelf: true }, n: { min: 1, max: 1 }, chooser: 'self' }, n: 1 },
    ],
  },
  effect: {
    kind: 'sequence',
    steps: [
      // 自分の裏向きの証拠を好きな数選び、表向きにする (bind '$flipped' = mirror-count 記録)
      { kind: 'atom', verb: 'evidenceFlip', args: { player: 'self', cardIds: '$pick.cardIds', max: 99, faceDown: true, bind: '$flipped' } },
      // 表向きにした枚数と同じ数まで相手の裏向きの証拠を選び、表向きにする
      { kind: 'atom', verb: 'evidenceFlip', args: { player: 'opp', cardIds: '$pick.cardIds', max: { dyn: '$bound.$flipped.count' }, faceDown: true } },
    ],
  },
  description: '【宣言】【スリープ】〚このキャラ以外のキャラを1枚リムーブエリアに移す〛：自分の裏向きの証拠を好きな数選び、表向きにする。この効果によって表向きにした枚数と同じ数まで相手の裏向きの証拠を選び、表向きにする。',
  ruleRefs: ['rules/03-field-areas.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/21-declared-ability-cost.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-evidence',
  trigger: { hook: 'evidence:remove-by-action', optional: true },
  effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
  description: '【ヒラメキ】（証拠からリムーブされるときに発動する）カードを1枚引く。',
  ruleRefs: ['rules/10-action-event.md', 'rules/14-refresh.md', 'rules/17-icons.md'],
};

export const B08028: CardDef = {
  id: 'B08028',
  no: '0868/B08028',
  kind: 'character',
  names: ['日向幸'],
  colors: ['緑'],
  level: 4,
  ap: 4000,
  lp: 1,
  traits: ['秘書'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1770731222516426.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/10-action-event.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md',
  ],
};
