// cards/ct-p08/B08070 小橋葵 (character) — Task A green候補 (engine変更0)
// rules: rules/15-abilities-effects.md, rules/19-special-rules.md, rules/21-declared-ability-cost.md
// 公式テキスト:
//   【宣言】【スリープ】〚デッキの下に移す〛：自分の現場にいるLP1以下の〚カード名［諸伏高明］〛を1枚まで選び、ターン終了時までLP＋1する。
// 句マッピング:
//   - 【宣言】 => type:'declared', scope:'on-scene' [declared AbilityType — src/cards/ct-p08/B08011.ts a2 (type:'declared',scope:'on-scene') exact-template twin; also ct-d11/D11012.ts a1, ct-p08/B08052.ts a1. Engine: capability-map §3 AbilityDef TYPES 'declared' = player-declared, cost paid §1 then runs effect; usable from scene chars (rules/21). Wired in src/engine/cost/{evaluate,pay}.ts.]
//   - 【スリープ】 (cost component 1 = sleep this char) => cost item {kind:'sleepSelf'} [src/engine/cost/evaluate.ts:15 case 'sleepSelf' (payable only if active) + src/engine/cost/pay.ts:36 sleeps ctx.source.uid. Exemplar src/cards/ct-p08/B08011.ts a2 cost.items[0]={kind:'sleepSelf'} for the IDENTICAL 【スリープ】 prefix. capability-map §1 Cost sleepSelf.]
//   - 〚デッキの下に移す〛 (cost component 2; 対象省略=自身 per rules/21) => cost item {kind:'selfToDeckBottom'} [src/engine/cost/evaluate.ts:49 case 'selfToDeckBottom' (payable if char exists) + src/engine/cost/pay.ts:90 moves ctx.source.uid to deck bottom. Exemplar src/cards/ct-p08/B08011.ts a2 cost.items[1]={kind:'selfToDeckBottom'} (same template); also ct-p08/B08052.ts a1 + ct-d11/D11012.ts a1. capability-map §1 Cost selfToDeckBottom (typed self-only, rules/21 cost-target省略=using char).]
//   - 【スリープ】〚デッキの下に移す〛 combined (two cost components, both required) => cost {kind:'pay', items:[sleepSelf, selfToDeckBottom]} [src/engine/cost/evaluate.ts:54 case 'pay' = composite AND (payable iff every item payable) + pay.ts:97. EXACT structural match src/cards/ct-p08/B08011.ts a2 cost:{kind:'pay',items:[{sleepSelf},{selfToDeckBottom}]}. capability-map §1 Cost pay{items:Cost[]}.]
//   - 自分の現場にいる … 〚カード名［諸伏高明］〛 (own scene char named 諸伏高明) => charModifyLP short-form pick filter:{cardName:'諸伏高明'}, side:'self' [cardName filter honored at src/engine/target/candidates.ts:240 matchOneFilter (split-name via allCardNameComponentsForDef). side='self' = 自分の現場 honored by buildShortFormPick (src/engine/effect/atom-pick-spec.ts:72 side ?? sideDefault → 'self' override). Exemplars: src/cards/ct-p08/B08011.ts a2 (cardName filter + side:'self'), ct-d11/D11012.ts a1 (charModifyLP side:'self' filter:{trait}). charModifyLP short-form handler src/engine/effect/atom-handlers.ts:749-758 builds PA pick honoring side+filter.]
//   - LP1以下の (effective LP ≤ 1; rules/19 LP can be negative → no lower bound) => filter:{lpMax:1} [lpMax honored at src/engine/target/candidates.ts:292 (if filter.lpMax!==undefined && lp>filter.lpMax return false); lp = effective LP (lpOverride + lpMod_perm/turn/contact + continuous). '以下'→lpMax only (no lpMin per rules/19 negatives). Exemplar src/cards/ct-p08/B08011.ts a2 filter:{cardName,lpMax:1} (same clause).]
//   - を1枚まで選び (pick 0–1; 0-pick legal) => short-form pick max:1 (nMin=0) [capability-map §Pick mechanisms: max-only short-form → nMin=0 ⇒ '〜枚まで' 0-pick legal (legalCount clamps to candidate count). charModifyLP handler src/engine/effect/atom-handlers.ts:751 hasNorMax(a) gate. Exemplar src/cards/ct-p08/B08011.ts a2 max:1; ct-d11/D11012.ts a1 charModifyLP max:1.]
//   - ターン終了時までLP＋1する => atom charModifyLP {delta:1, scope:'turn'} [src/engine/effect/atom-handlers.ts:768-772 charModifyLP → mutate.char.modifyLP(s, uid, delta, scope) with scope:'turn' (lpMod_turn cleared end-of-turn). EXACT exemplar src/cards/ct-p08/B08011.ts a2 charModifyLP {delta:1,scope:'turn'} (identical clause) and ct-d11/D11012.ts a1 charModifyLP {delta:1,...,scope:'turn'}. capability-map §Char modify charModifyLP.]

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'declared',
  scope: 'on-scene',
  cost: {
    kind: 'pay',
    items: [
      {
        kind: 'sleepSelf'
      },
      {
        kind: 'selfToDeckBottom'
      }
    ]
  },
  effect: {
    kind: 'atom',
    verb: 'charModifyLP',
    args: {
      delta: 1,
      max: 1,
      side: 'self',
      filter: {
        cardName: '諸伏高明',
        lpMax: 1
      },
      scope: 'turn'
    }
  },
  description: '【宣言】【スリープ】〚デッキの下に移す〛：自分の現場にいるLP1以下の〚カード名［諸伏高明］〛を1枚まで選び、ターン終了時までLP＋1する。',
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/19-special-rules.md',
    'rules/21-declared-ability-cost.md'
  ]
};

export const B08070: CardDef = {
  id: 'B08070',
  no: '0907/B08070',
  kind: 'character',
  names: [
    '小橋葵'
  ],
  colors: [
    '黄'
  ],
  level: 3,
  ap: 2000,
  lp: 1,
  traits: [
    '小説家'
  ],
  rarity: 'C',
  imageUrl: '1770731255749334.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/19-special-rules.md',
    'rules/21-declared-ability-cost.md'
  ],
};
