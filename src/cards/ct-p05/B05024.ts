// cards/ct-p05/B05024 妃弁護士SOS (case) — Task A green候補 (engine変更0)
// rules: rules/01-victory-conditions.md, rules/13-keywords.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/21-declared-ability-cost.md
// 公式テキスト:
//   この事件が解決編になったとき、自分は手札を1枚リムーブする。\n【解決編】【宣言】【ターン1】〚裏向きの証拠を3つ表向きにする〛：自分の現場にいるレベル5以上の〚カード名［毛利小五郎］〛を1枚まで選び、ターン終了時まで〚突撃［キャラ］〛（登場したターンからすぐにキャラを指定してアクションできる）と〚ブレット〛（このキャラのアクションはガードできない）を与える。
// 句マッピング:
//   - この事件が解決編になったとき、自分は手札を1枚リムーブする。 => __shared caseResolvedHandRemove({n:1}) — triggered, hook 'case:to-resolved', matcher player==='self', scope 'always', effect choice→discard pick {area:'hand',side:'self',n:{min:1,max:1}} [src/cards/_shared/caseResolvedHandRemove.ts (verbatim factory: scope 'always' for case-area; case:to-resolved hook w/ matcher player==='self'; discard from hand n=1). Hook honored: capability-map hooks §case:to-resolved (payload {player}, source case uid, emitted by mutate/case.ts; fires once, one-way rules/01). discard verb  capability-map atom §discard (defaultArea=hand, Pattern B pick). EXACT in-repo twin src/cards/ct-d09/D09027.ts a1 uses caseResolvedHandRemove({n:1,abilityId:'a1'}).]
//   - 【解決編】 (条件アイコン) => a2.condition = {kind 'caseStatus', status:'解決編'} [capability-map Conditions §caseStatus {status:'事件編'|'解決編'} (cond/eval.ts: owner case status equals). Exemplars src/cards/_shared/caseDeclaredEvidenceFlip.ts baseCond and src/cards/ct-d09/D09027.ts a2.condition (identical).]
//   - 【宣言】 => a2.type='declared', scope 'always' [capability-map §3 AbilityType 'declared' (cost paid then effect runs; usable from own case). scope 'always' required because case card sits in 'case' area — verbatim rationale in src/cards/_shared/caseDeclaredEvidenceFlip.ts comment (user_request 20260522_01 #5). EXACT exemplar src/cards/ct-d09/D09027.ts a2.]
//   - 【ターン1】 => a2.limit = {kind 'turn', n:1} [capability-map §3 declared limit {turn:1} (declaredUseCount enforced per uid+abilityId). Exemplars src/cards/ct-d09/D09027.ts a2 limit:{kind 'turn',n:1}; src/cards/_shared/caseDeclaredEvidenceFlip.ts.]
//   - 〚裏向きの証拠を3つ表向きにする〛 (コスト) => a2.cost = {kind 'flipFaceUpEvidence', n:{min:3,max:3}} [capability-map Costs §flipFaceUpEvidence {n:{min,max}} — payable if facedown count >= n.min; pay THROWS if picked count ∉[min,max], so {min:3,max:3} forces exactly 3 (rules/21: コストは全部行う). EXACT exemplar src/cards/ct-d09/D09027.ts a2 cost flipFaceUpEvidence{min:3,max:3} (same 「3つ表向きにする」 text).]
//   - 自分の現場にいるレベル5以上の〚カード名［毛利小五郎］〛を1枚まで選び、ターン終了時まで〚突撃［キャラ］〛を与える => a2 step1: charGrantKeyword SHORT-FORM carrier {player:'self', max:1, side:'self', filter:{cardName:'毛利小五郎', levelMin:5}, kw:'突撃[キャラ]', scope 'turn', bind:'$picked'} [EXACT carrier shape src/cards/ct-p09/B09032.ts a1 step1 (charGrantKeyword short-form: player/max/side/filter/kw/scope/bind:'$picked'; comment warns explicit uid:'$pick'+target carrier loses bind on human path → short-form REQUIRED). 「自分の現場にいる」=side:'self'. filter cardName honored by matchOneFilter via allCardNameComponentsForDef (D10020.ts a1 cardName:'毛利蘭'); levelMin honored on scene candidates (capability-map L246; src/cards/ct-p08/B08058P.ts:33 uses levelMin in scene pick). 毛利小五郎 is a registered name (src/cards/ct-p01/B01004.ts names). 'max:1'='1枚まで'=nMin 0 skippable (rules/15). kw '突撃[キャラ]' honored by engine action gate src/engine/flow/main/action.ts:55 (targetKind==='char' && kws.includes('突撃[キャラ]')); turn-scope grant read via src/engine/read/char.ts:166 grantedKeywords, cleared at turn end src/engine/flow/turn.ts:91. EXACT kw value src/cards/ct-d09/D09027.ts:49 / ct-d11/D11015.ts:35 ('突撃[キャラ]' ASCII brackets).]
//   - と〚ブレット〛（このキャラのアクションはガードできない）を与える => a2 step2: charGrantKeyword {uid:'$picked.uid', kw:'ブレット', scope 'turn'} (same picked char as step1 via bind) [Multi-effect on ONE pick via bind writeback: src/engine/effect/atom-handlers.ts:286-304 accumulates resolved picked char {kind 'char',uid,cardId,player} into ctx.bindings['$picked']; step2 resolves '$picked.uid' via resolveBindRef (atom-handlers.ts:190-197). EXACT pattern src/cards/ct-p09/B09032.ts a1 step2 ('$picked.uid' second effect on the same pick). 0-pick (1枚まで) ⇒ '$picked' empty ⇒ resolveBindRef returns '$picked.uid' unchanged ⇒ charGrantKeyword $-unresolved uid → silent no-op (capability-map atom §charGrantKeyword). kw 'ブレット' honored by guard gate src/engine/flow/guard.ts:47 (hasKeyword 'ブレット' → guard candidates=[]); EXACT kw value src/cards/ct-d04/D04004.ts:18.]

import type { AbilityDef, CardDef } from '@/engine/types';
import { caseResolvedHandRemove } from '@/cards/_shared';

// a1: この事件が解決編になったとき、自分は手札を1枚リムーブする。
// 共有 factory (D09027 a1 と byte 同一)。codegen は closure matcher を JSON で書けないため
// 手動で factory 呼び出しに差し替え (validate-specs: trigger.matcher closure forbidden → 解消)。
const a1 = caseResolvedHandRemove({ n: 1, abilityId: 'a1' });

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
    kind: 'sequence',
    steps: [
      {
        kind: 'atom',
        verb: 'charGrantKeyword',
        args: {
          player: 'self',
          max: 1,
          side: 'self',
          filter: {
            cardName: '毛利小五郎',
            levelMin: 5
          },
          kw: '突撃[キャラ]',
          scope: 'turn',
          bind: '$picked'
        }
      },
      {
        kind: 'atom',
        verb: 'charGrantKeyword',
        args: {
          uid: '$picked.uid',
          kw: 'ブレット',
          scope: 'turn'
        }
      }
    ]
  },
  description: '【解決編】【宣言】【ターン1】〚裏向きの証拠を3つ表向きにする〛：自分の現場にいるレベル5以上の〚カード名［毛利小五郎］〛を1枚まで選び、ターン終了時まで〚突撃［キャラ］〛（登場したターンからすぐにキャラを指定してアクションできる）と〚ブレット〛（このキャラのアクションはガードできない）を与える。',
  ruleRefs: [
    'rules/01-victory-conditions.md',
    'rules/13-keywords.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md'
  ]
};

export const B05024: CardDef = {
  id: 'B05024',
  no: '0530/B05024',
  kind: 'case',
  names: [
    '妃弁護士SOS'
  ],
  colors: [
    '青'
  ],
  caseTraits: [],
  traits: [],
  rarity: 'C',
  imageUrl: '1745322178420472.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/01-victory-conditions.md',
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md'
  ],
};
