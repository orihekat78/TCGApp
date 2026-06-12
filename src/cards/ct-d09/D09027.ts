// cards/ct-d09/D09027 死亡の館、赤い壁 (case) — Task A green候補 (engine変更0)
// rules: rules/01-victory-conditions.md, rules/13-keywords.md, rules/17-icons.md, rules/21-declared-ability-cost.md
// 公式テキスト:
//   この事件が解決編になったとき、自分は手札を1枚リムーブする。\n【解決編】【宣言】【ターン1】〚裏向きの証拠を3つ表向きにする〛：〚特徴［長野県警］〛のキャラを1枚まで選び、ターン終了時まで〚突撃［キャラ］〛を与える。
// 句マッピング:
//   - この事件が解決編になったとき、自分は手札を1枚リムーブする。 => __shared caseResolvedHandRemove({n:1}) — type:'triggered', hook:'case:to-resolved', matcher player==='self', scope:'always', effect choice→discard pick {area:'hand',side:'self',n:{min:1,max:1}} [src/cards/_shared/caseResolvedHandRemove.ts (verbatim factory: scope:'always' for case-area, case:to-resolved hook w/ matcher player==='self', discard from hand n=1). Hook honored: capability-map hooks §case:to-resolved (payload {player}, source case uid, selfOnly via case uid; emitted by mutate/case.ts). discard verb: capability-map atom verbs §discard (defaultArea=hand, Pattern B pick).]
//   - 【解決編】（条件アイコン） => condition:{kind:'caseStatus',status:'解決編'} [capability-map Conditions §caseStatus {status:'事件編'|'解決編'} (cond/eval.ts: owner case status equals). Exemplar src/cards/_shared/caseDeclaredEvidenceFlip.ts baseCond = {kind:'caseStatus',status:'解決編'}.]
//   - 【宣言】 => type:'declared' (case ability, scope:'always') [capability-map §3 AbilityType 'declared' (cost paid then effect runs; usable from own case). scope:'always' required because case card sits in 'case' area (on-scene/on-* would be filtered out) — verbatim rationale in src/cards/_shared/caseDeclaredEvidenceFlip.ts comment (user_request 20260522_01 #5 fix).]
//   - 【ターン1】 => limit:{kind:'turn',n:1} [capability-map §3 declared limit {turn:1}. Exemplar src/cards/ct-d02/D02013.ts a1 limit:{kind:'turn',n:1}; src/cards/_shared/caseDeclaredEvidenceFlip.ts limit:{kind:'turn',n:1}.]
//   - 〚裏向きの証拠を3つ表向きにする〛 (コスト) => cost:{kind:'flipFaceUpEvidence',n:{min:3,max:3}} [src/engine/cost/evaluate.ts:73 canPay flipFaceUpEvidence requires facedown evidence >= cost.n.min (=3); src/engine/cost/pay.ts:147-161 pays exactly indices∈[min,max] (THROWS if count∉[3,3]), records $cost.flipFaceUpEvidence.count. Exact-3 = n:{min:3,max:3}. Exemplar shape src/cards/ct-d08/D08005.ts cost:{kind:'flipFaceUpEvidence',n:{min:1,max:1}}.]
//   - 〚特徴［長野県警］〛のキャラを1枚まで選び、ターン終了時まで〚突撃［キャラ］〛を与える。 => effect choice→atom charGrantKeyword {uid:'$pick', kw:'突撃[キャラ]', scope:'turn', target pick {area:'scene', side:'either', filter:{trait:'長野県警'}, n:{min:0,max:1}, chooser:'self'}} [EXACT structural exemplar src/cards/ct-p01/B01094.ts:31 (charGrantKeyword uid:'$pick' kw:'突撃[キャラ]' scope:'turn' target pick n:{min:0,max:1}) and src/cards/ct-d02/D02013.ts a1 (same '1枚まで選び 突撃 付与' shape). kw string '突撃[キャラ]' honored by engine action gate src/engine/flow/main/action.ts:55 (kws.includes('突撃[キャラ]')). filter trait:'長野県警' is a real CardDef trait (src/cards/ct-p08/B08065.ts:62 traits incl '長野県警'; used in target filter at B08065.ts:44). n.min:0 ⇒ '〜まで'=0枚可 (capability-map Pick: nMin===0 skippable). charGrantKeyword scope:'turn' = ターン終了時まで.]

import type { AbilityDef, CardDef } from '@/engine/types';
import { caseResolvedHandRemove } from '@/cards/_shared';

const a1 = caseResolvedHandRemove({
  n: 1,
  abilityId: 'a1'
});

const a2: AbilityDef = {
  id: 'a2',
  type: 'declared',
  scope: 'always',
  condition: {
    kind: 'caseStatus',
    status: '解決編'
  },
  limit: {
    kind: 'turn',
    n: 1
  },
  cost: {
    kind: 'flipFaceUpEvidence',
    n: {
      min: 3,
      max: 3
    }
  },
  effect: {
    kind: 'choice',
    chooser: 'self',
    options: [
      {
        kind: 'atom',
        verb: 'charGrantKeyword',
        args: {
          uid: '$pick',
          kw: '突撃[キャラ]',
          scope: 'turn',
          target: {
            kind: 'pick',
            query: {
              area: 'scene',
              side: 'either',
              filter: {
                trait: '長野県警'
              }
            },
            n: {
              min: 0,
              max: 1
            },
            chooser: 'self'
          }
        }
      }
    ]
  },
  description: '【解決編】【宣言】【ターン1】〚裏向きの証拠を3つ表向きにする〛：〚特徴［長野県警］〛のキャラを1枚まで選び、ターン終了時まで〚突撃［キャラ］〛を与える。',
  ruleRefs: [
    'rules/01-victory-conditions.md',
    'rules/13-keywords.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md'
  ]
};

export const D09027: CardDef = {
  id: 'D09027',
  no: '0510/D09027',
  kind: 'case',
  names: [
    '死亡の館、赤い壁'
  ],
  colors: [
    '黄'
  ],
  caseTraits: [],
  traits: [],
  rarity: 'D',
  imageUrl: '1743742883084496.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/01-victory-conditions.md',
    'rules/13-keywords.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md'
  ],
};
