// cards/ct-p08/B08011 東尾マリア (character) — Task A green候補 (engine変更0)
// rules: rules/13-keywords.md, rules/15-abilities-effects.md, rules/19-special-rules.md, rules/21-declared-ability-cost.md
// 公式テキスト:
//   〚ミスリード1〛（相手の推理に対し、スリープさせることでLP－1する）\n【宣言】【スリープ】〚デッキの下に移す〛：自分の現場にいるLP1以下の〚カード名［灰原哀］〛を1枚まで選び、ターン終了時までLP＋1する。
// 句マッピング:
//   - 〚ミスリード1〛（相手の推理に対し、スリープさせることでLP－1する） => __shared misreadX({x:1}) → type:'icon-misread', scope:'on-scene' [src/cards/_shared/misreadX.ts (exports misreadX returning {type:'icon-misread',scope:'on-scene',effect:noop marker x}); exemplars src/cards/ct-p02/B02082.ts a1, ct-p03/B03037.ts a1, ct-d03/D03010.ts a1 use misreadX({x:1,abilityId:'a1'}). Engine: src/engine/listeners/misread.ts consumes icon-misread on reasoning:before-add (sleep holder + LP-X). capability-map §misread / §_shared misreadX.]
//   - 【宣言】 (declared ability) => type:'declared', scope:'on-scene' [src/cards/ct-p03/B03011.ts a1 (type:'declared',scope:'on-scene'), ct-d11/D11012.ts a1, ct-p07/B07101.ts a1. capability-map §AbilityDef TYPES declared (cost paid §1 then runs effect).]
//   - 【スリープ】 (cost component 1) => cost item {kind:'sleepSelf'} [capability-map §1 Cost: sleepSelf sleeps ctx.source.uid (payable only if active). Standalone exemplars src/cards/ct-p03/B03010.ts:18, ct-p03/B03021.ts:18, ct-p09/B09100.ts:18. Combined-in-pay exemplar src/cards/ct-p07/B07101.ts (pay[sleepSelf, removeFromScene]).]
//   - 〚デッキの下に移す〛 (cost component 2; 対象省略=自身, rules/21) => cost item {kind:'selfToDeckBottom'} [capability-map §1 Cost: selfToDeckBottom moves ctx.source.uid char to deck bottom (payable if char exists). Exemplar src/cards/ct-p03/B03011.ts:18 cost:{kind:'selfToDeckBottom'} for 〚デッキの下に移す〛; also ct-d11/D11012.ts a1. rules/21 cost-target省略=using char.]
//   - 【スリープ】〚デッキの下に移す〛 combined (two cost components) => cost {kind:'pay', items:[sleepSelf, selfToDeckBottom]} [capability-map §1 Cost: pay{items:Cost[]} = composite AND (payable iff every item payable). Exemplars src/cards/ct-p08/B08009.ts a1 cost:pay[sleepSelf, removeDeckTop], ct-p07/B07101.ts a1 cost:pay[sleepSelf, removeFromScene].]
//   - 自分の現場にいる … 〚カード名［灰原哀］〛 (own scene, name=灰原哀) => charModifyLP short-form pick filter:{cardName:'灰原哀'}, side:'self' [filter cardName grounded src/cards/ct-p05/B05018.ts:19 (charModifyAP filter:{cardName:'灰原哀'}) and ct-d11/D11012.ts a2 (cardName filter). 'side:self'=自分の現場 grounded src/cards/ct-p09/B09083.ts:20 (charModifyAP side:'self' filter:{cardName:[...]}) and ct-d11/D11012.ts a1 (charModifyLP side:'self'). cardName honored at src/engine/target/candidates.ts:240 matchOneFilter.]
//   - LP1以下の (LP ≤ 1) => filter:{lpMax:1} (no lpMin — negatives allowed per rules/19) [lpMax honored at src/engine/target/candidates.ts:292 (if filter.lpMax!==undefined && lp>filter.lpMax return false), lp = lpOverride+lpMod_perm/turn/contact+continuous (candidates.ts:284) = effective LP. lpMax-filter precedent src/cards/ct-p03/B03011.ts:20 (lpMin:0,lpMax:0) and ct-d11/D11012.ts a1. '以下'→lpMax only; rules/19 LP can be negative so no lower bound.]
//   - を1枚まで選び (pick 0–1) => short-form pick max:1 (nMin=0 → 0-pick legal) [capability-map §Pick mechanisms: nMin/nMax from target.n; max-only short-form → nMin=0 ⇒ '〜枚まで' 0-pick legal. Exemplars src/cards/ct-p03/B03011.ts:20, ct-d11/D11012.ts a1 (charModifyLP max:1), ct-p07/B07101.ts a1 (sceneSetState max:1).]
//   - ターン終了時までLP＋1する => atom charModifyLP {delta:1, scope:'turn'} [capability-map §Char modify: charModifyLP same shape as charModifyAP (mutate.char.modifyLP, scope turn=lpMod_turn cleared end-of-turn). EXACT exemplar src/cards/ct-d11/D11012.ts a1 charModifyLP {delta:1,max:1,side:'self',filter,scope:'turn'} and ct-p03/B03011.ts:20 charModifyLP {delta:1,...,scope:'turn'}.]

import type { AbilityDef, CardDef } from '@/engine/types';
import { misreadX } from '@/cards/_shared';

const a1 = misreadX({
  x: 1,
  abilityId: 'a1'
});

const a2: AbilityDef = {
  id: 'a2',
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
        cardName: '灰原哀',
        lpMax: 1
      },
      scope: 'turn'
    }
  },
  description: '【宣言】【スリープ】〚デッキの下に移す〛：自分の現場にいるLP1以下の〚カード名［灰原哀］〛を1枚まで選び、ターン終了時までLP＋1する。',
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/19-special-rules.md',
    'rules/21-declared-ability-cost.md'
  ]
};

export const B08011: CardDef = {
  id: 'B08011',
  no: '0852/B08011',
  kind: 'character',
  names: [
    '東尾マリア'
  ],
  colors: [
    '青'
  ],
  level: 3,
  ap: 2000,
  lp: 0,
  traits: [],
  rarity: 'C',
  imageUrl: '1770731204362110.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/19-special-rules.md',
    'rules/21-declared-ability-cost.md'
  ],
};
