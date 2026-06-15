// cards/ct-p07/B07098P キャンティ (character) — Task A green候補 (engine変更0)
// rules: rules/14-refresh.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/19-special-rules.md, rules/21-declared-ability-cost.md, rules/09-cutin-disguise.md, rules/22-qa-action-contact.md
// 公式テキスト:
//   【事件編】【登場時】自分のデッキのカードを上から2枚リムーブする。自分のリムーブエリアに【カットイン】を持つカードがある場合、カードを1枚引く。\n【解決編】【宣言】【ターン1】〚手札から【カットイン】を持つ【黒】のカードを1枚リムーブする〛：自分のリムーブエリアにある【カットイン】を持つ【黒】のカード1枚につき、ターン終了時までこのキャラをAP＋1000する。
//   【カットイン】AP＋1000
// 句マッピング:
//   - 【事件編】 (a1 ability-level icon) => ability.condition { kind 'caseStatus', status:'事件編' } [cond/eval.ts caseStatus compares owner case status; exemplar B05089.ts a1 line17 uses exactly {kind 'caseStatus',status:'事件編'} as 【事件編】 gate.]
//   - 【登場時】 (a1 trigger) => trigger { hook 'enter', selfOnly:true } [capability-map hooks: enter = 登場時, selfOnly via source.uid; exemplar B05089.ts a1 line20 trigger {hook 'enter',selfOnly:true}; emit site atom-handlers sceneEnter/next-hint/hand-use.]
//   - 自分のデッキのカードを上から2枚リムーブする => atom mill { player:'self', n:2 } [atom-handlers.ts:361 case 'mill' → mutate.deck.removeFromTop(p,n) (+ refresh guard BUG-137); exemplar B09064.ts line37 verb 'mill' args {player,n}.]
//   - 自分のリムーブエリアに【カットイン】を持つカードがある場合 (a1 conditional if) => conditional.if = sceneHas { query:{area:'remove', side:'self', filter:{keyword:'カットイン'}}, nMin:1 } [cond/eval.ts:91 sceneHas calls candidates(all,query) and checks length>=nMin; candidates.ts:160 area 'remove' emits card candidates filtered via matchOneFilter; matchOneFilter line280-287 honors filter.keyword via defHasKeyword (BUG-122: カットイン icon ability resolved). Exemplar keyword filter B05112.ts line17 / B03128.ts line40.]
//   - カードを1枚引く (a1 then) => atom draw { player:'self', n:1 } [capability-map draw verb {player,n}; B05089.ts a1 line21 verb 'draw' args {player:'self',n:1}.]
//   - 【解決編】 (a2 ability-level icon) => ability.condition { kind 'caseStatus', status:'解決編' } [cond/eval.ts caseStatus; _shared/caseDeclaredEvidenceFlip.ts uses baseCond {kind 'caseStatus',status:'解決編'} for the same 【解決編】【宣言】 family; B05089.ts a2 line30.]
//   - 【宣言】【ターン1】 (a2) => type 'declared' + limit {kind 'turn', n:1} [card-def AbilityType 'declared' (cap-map §3); _shared/caseDeclaredEvidenceFlip.ts declared+limit{turn,1}+scope 'always' (事件/case-area declared must be 'always' to be listed). Same family — declared usable from scene char too (declaredUseCount per uid+abilityId).]
//   - 〚手札から【カットイン】を持つ【黒】のカードを1枚リムーブする〛 (a2 cost) => cost { kind 'removeFromHand', target:{pick area:'hand' side:'self' filter:{keyword:'カットイン', color:'黒'}, n:{min:1,max:1}}, n:1 } [cost/evaluate.ts removeFromHand{target,n} payable if candidates>=n; exemplar B03074.ts line19 removeFromHand with query.filter (cardName) → filter honored; keyword+color filter shape proven by B03128.ts line40 filter:{keyword:'カットイン',color:'黒'}. 'カード' (not キャラ) → no kind restriction (rules/21 「自分の」省略).]
//   - 自分のリムーブエリアにある【カットイン】を持つ【黒】のカード1枚につき、ターン終了時までこのキャラをAP＋1000する (a2 effect) => forEach over:{kind 'all', query:{area:'remove', side:'self', filter:{keyword:'カットイン', color:'黒'}}} do: atom charModifyAP {uid:'$self', delta:1000, scope 'turn'} [DIRECT precedent src/cards/ct-d02/D02004.ts a1 — '…1枚につき…このキャラをAP＋1000する' mapped via forEach over:all + charModifyAP{uid:'$self',delta:1000,scope 'turn'}. resolver.ts:121 forEach resolves over via candidates() and runs 'do' once per candidate; atom-handlers.ts:167 uid '$self' → ctx.source.uid (キャンティ); mutate/char.ts:29-34 modifyAP ACCUMULATES (current+delta) so N matches = +1000*N. scope 'turn' = ターン終了時まで (cleaner than D02004's APPROX). Remove-area count avoids the missing dyn (dyn/eval.ts resolveSelf has NO remove-area count placeholder — forEach-over-all is the engine-supported scaling-by-count idiom, foreach-all.test.ts primitive-tested).]
//   - このキャラ (a2 target of AP buff) => charModifyAP uid:'$self' [atom-handlers.ts:167 value==='$self' → source uid; B05089.ts a2 charGrantKeyword{uid:'$self'} same 'このキャラ' idiom; D02004.ts a1 charModifyAP{uid:'$self'}.]
//   - 【カットイン】AP＋1000 (a3) => type 'triggered', scope 'on-hand', trigger {hook 'effect:declared', optional:true, selfOnly:true}, effect: atom charModifyAP {uid:'$contact.byUid', delta:1000, scope 'contact'} [EXACT twin src/cards/ct-d02/D02012.ts a1 (【カットイン】AP＋2000 → only delta differs). read/keyword.ts abilityIsCutin detects this shape; flow/contact.ts fires it via effect:declared {abilityId:'cutin'}; dyn/eval.ts $contact.byUid = attacker uid (cap-map §$contact). Color-unrestricted per rules/09.]

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  condition: {
    kind: 'caseStatus',
    status: '事件編'
  },
  trigger: {
    hook: 'enter',
    selfOnly: true
  },
  effect: {
    kind: 'sequence',
    steps: [
      {
        kind: 'atom',
        verb: 'mill',
        args: {
          player: 'self',
          n: 2
        }
      },
      {
        kind: 'conditional',
        if: {
          kind: 'sceneHas',
          query: {
            area: 'remove',
            side: 'self',
            filter: {
              keyword: 'カットイン'
            }
          },
          nMin: 1
        },
        then: {
          kind: 'atom',
          verb: 'draw',
          args: {
            player: 'self',
            n: 1
          }
        }
      }
    ]
  },
  description: '【事件編】【登場時】自分のデッキのカードを上から2枚リムーブする。自分のリムーブエリアに【カットイン】を持つカードがある場合、カードを1枚引く。',
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/14-refresh.md'
  ]
};

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
    kind: 'removeFromHand',
    target: {
      kind: 'pick',
      query: {
        area: 'hand',
        side: 'self',
        filter: {
          keyword: 'カットイン',
          color: '黒'
        }
      },
      n: {
        min: 1,
        max: 1
      },
      chooser: 'self'
    },
    n: 1
  },
  effect: {
    kind: 'forEach',
    over: {
      kind: 'all',
      query: {
        area: 'remove',
        side: 'self',
        filter: {
          keyword: 'カットイン',
          color: '黒'
        }
      }
    },
    do: {
      kind: 'atom',
      verb: 'charModifyAP',
      args: {
        uid: '$self',
        delta: 1000,
        scope: 'turn'
      }
    }
  },
  description: '【解決編】【宣言】【ターン1】〚手札から【カットイン】を持つ【黒】のカードを1枚リムーブする〛：自分のリムーブエリアにある【カットイン】を持つ【黒】のカード1枚につき、ターン終了時までこのキャラをAP＋1000する。',
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/19-special-rules.md',
    'rules/21-declared-ability-cost.md'
  ]
};

const a3: AbilityDef = {
  id: 'a3',
  type: 'triggered',
  scope: 'on-hand',
  trigger: {
    hook: 'effect:declared',
    optional: true,
    selfOnly: true
  },
  effect: {
    kind: 'atom',
    verb: 'charModifyAP',
    args: {
      uid: '$contact.byUid',
      delta: 1000,
      scope: 'contact'
    }
  },
  description: '【カットイン】AP＋1000',
  ruleRefs: [
    'rules/09-cutin-disguise.md',
    'rules/22-qa-action-contact.md'
  ]
};

export const B07098P: CardDef = {
  id: 'B07098P',
  no: '0825/B07098P',
  kind: 'character',
  names: [
    'キャンティ'
  ],
  colors: [
    '黒'
  ],
  level: 3,
  ap: 2000,
  lp: 1,
  traits: [
    '黒ずくめの組織'
  ],
  rarity: 'RP',
  imageUrl: '1763546840495980.jpg',
  abilities: [a1, a2, a3],
  ruleRefs: [
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/19-special-rules.md',
    'rules/21-declared-ability-cost.md',
    'rules/09-cutin-disguise.md',
    'rules/22-qa-action-contact.md'
  ],
};
