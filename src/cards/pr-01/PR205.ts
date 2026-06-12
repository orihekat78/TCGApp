// cards/pr-01/PR205 江戸川コナン (character) — Task A green候補 (engine変更0)
// rules: rules/21-declared-ability-cost.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/13-keywords.md, rules/19-special-rules.md, rules/03-field-areas.md, rules/11-reasoning.md
// 公式テキスト:
//   【FILE5】【宣言】【ターン1】【スリープ】：以下から1つ選んで行う。\n・手札を1枚リムーブしてもよい。そうした場合、レベル4以下のキャラを1枚まで選び、リムーブする。\n・手札を1枚リムーブしてもよい。そうした場合、自分の現場にいるLP0の〚カード名［毛利小五郎］〛を1枚まで選び、アクティブにする。\n・自分の現場にいるLP0の〚カード名［毛利小五郎］〛を1枚まで選び、ターン終了時まで〚突撃〛を与える。
// 句マッピング:
//   - 【FILE5】 => condition:{kind:'fileAtLeast', n:5} gating declarability [Condition 'fileAtLeast' (capability-map cond §FILE; owner file.length>=n, assisted-partner counted). Exemplar src/cards/ct-d09/D09014.ts a1 condition:{kind:'fileAtLeast',n:7}; declared-ability gating via evalCond(condition) per BUG-099 noted in src/cards/ct-p09/B09058.ts comment (declared-ability.ts:90-95).]
//   - 【宣言】 => type:'declared', scope:'on-scene' [AbilityType 'declared' (capability-map §3). Exemplar src/cards/ct-p07/B07079.ts a1 (type:'declared', scope:'on-scene') and src/cards/ct-d07/D07008.ts a1.]
//   - 【ターン1】 => limit:{kind:'turn', n:1} [limit turn:1 (capability-map §B, declaredUseCount per uid+abilityId). VERBATIM in src/cards/ct-p07/B07079.ts a1 limit:{kind:'turn',n:1} and src/cards/ct-d02/D02013.ts a1.]
//   - 【スリープ】 (コスト) => cost:{kind:'sleepSelf'} [Cost kind 'sleepSelf' (capability-map §1; payable only if char active → sleep/stun unable to declare, rules/21 engine-enforced). VERBATIM in src/cards/ct-d09/D09014.ts a2 cost:{kind:'sleepSelf'} and src/cards/ct-d08/D08005.ts.]
//   - 以下から1つ選んで行う。 => effect:{kind:'choice', chooser:'self', options:[3]} [choice wrapper, 1-of-N select (capability-map §C choice; brief: '以下からN つ選んで行う'=choice 1択実行). Exemplar src/cards/ct-p07/B07079.ts a1 (choice chooser:'self', 2 options for '〜するか'). Human picks option via __pendingEffectChoiceSide then applyChoiceAndContinuation re-walks chosen option (apply-pick.ts).]
//   - ・手札を1枚リムーブしてもよい。そうした場合、レベル4以下のキャラを1枚まで選び、リムーブする。 => option0: {kind:'optional', effect:{kind:'chain', steps:[discard{player:'self',n:1}, sceneRemove{max:1, side:'either', filter:{levelMax:4}, cause:'effect'}]}} [optional+chain 'してもよい。そうした場合' (brief pattern; chain breaks if discard no-candidate=手札0). VERBATIM optional+chain+discard prefix in src/cards/ct-p09/B09058.ts a1 (optional{chain[sceneSetState$self, discard n:1, sceneEnter]}). sceneRemove short-form with filter+side:'either' (側指定なし=どちらの現場 rules/15) VERBATIM in src/cards/ct-p07/B07079.ts a1 step1 (sceneRemove{player:'self',max:1,side:'either',filter,cause:'effect'}). levelMax honored in matchOneFilter (src/engine/target/candidates.ts: filter.levelMax via effective level).]
//   - ・手札を1枚リムーブしてもよい。そうした場合、自分の現場にいるLP0の〚カード名［毛利小五郎］〛を1枚まで選び、アクティブにする。 => option1: {kind:'optional', effect:{kind:'chain', steps:[discard{player:'self',n:1}, sceneSetState{max:1, side:'self', state:'active', filter:{cardName:'毛利小五郎', lpMin:0, lpMax:0}}]}} [sceneSetState Pattern-A short-form pick (ATOM_PICK_SPEC sceneSetState mode PA, needs state). state:'active' VERBATIM in src/cards/ct-d11/D11003.ts a3 (sceneSetState{player:'self',max:1,side:'either',state:'active'}). cardName filter (split-name) honored in matchOneFilter (src/engine/target/candidates.ts allCardNameComponentsForDef). 'LP0'=lpMin:0+lpMax:0 exact-0 VERBATIM in src/cards/ct-d11/D11012.ts a1 (comment: 'LP0='有効LPちょうど0', lpMin:0+lpMax:0) and src/cards/ct-p05/B05019.ts a1. side:'self'='自分の現場にいる'. STUN→active special handled engine-side in mutate.scene.setState (rules/03).]
//   - ・自分の現場にいるLP0の〚カード名［毛利小五郎］〛を1枚まで選び、ターン終了時まで〚突撃〛を与える。 => option2: {kind:'atom', verb:'charGrantKeyword', args:{uid:'$pick', kw:'突撃', scope:'turn', target:{kind:'pick', query:{area:'scene', side:'self', filter:{cardName:'毛利小五郎', lpMin:0, lpMax:0}}, n:{min:0,max:1}, chooser:'self'}}} [charGrantKeyword Pattern-A pick (uid:'$pick' + explicit target) VERBATIM in src/cards/ct-d02/D02013.ts a1 (declared→choice→charGrantKeyword{uid:'$pick',kw:'突撃',scope:'turn',target:{pick}}). Pattern A push is generic in substituteAtomPick (src/engine/effect/resolve-picks.ts: isPatternA=args.uid==='$pick' + target.kind==='pick'; not suppressed for human, unlike Pattern B). apply-pick.ts rewrites uid:'$pick'→picked.uid; charGrantKeyword handler (atom-handlers.ts case 'charGrantKeyword') grants via resolveBindRef+mutate.char.grantKeyword. Choice re-walk surfaces this pick (applyChoiceAndContinuation→resolveEffectPicks, apply-pick.ts comment references 'option1 charGrantKeyword'). kw:'突撃' scope:'turn' proven in src/cards/ct-d08/D08005.ts. cardName+lpMin0+lpMax0 filter as in option1 grounding.]

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'declared',
  scope: 'on-scene',
  condition: {
    kind: 'fileAtLeast',
    n: 5
  },
  limit: {
    kind: 'turn',
    n: 1
  },
  cost: {
    kind: 'sleepSelf'
  },
  effect: {
    kind: 'choice',
    chooser: 'self',
    options: [
      {
        kind: 'optional',
        effect: {
          kind: 'chain',
          steps: [
            {
              kind: 'atom',
              verb: 'discard',
              args: {
                player: 'self',
                n: 1
              }
            },
            {
              kind: 'atom',
              verb: 'sceneRemove',
              args: {
                player: 'self',
                max: 1,
                side: 'either',
                filter: {
                  levelMax: 4
                },
                cause: 'effect'
              }
            }
          ]
        }
      },
      {
        kind: 'optional',
        effect: {
          kind: 'chain',
          steps: [
            {
              kind: 'atom',
              verb: 'discard',
              args: {
                player: 'self',
                n: 1
              }
            },
            {
              kind: 'atom',
              verb: 'sceneSetState',
              args: {
                player: 'self',
                max: 1,
                side: 'self',
                state: 'active',
                filter: {
                  cardName: '毛利小五郎',
                  lpMin: 0,
                  lpMax: 0
                }
              }
            }
          ]
        }
      },
      {
        kind: 'atom',
        verb: 'charGrantKeyword',
        args: {
          uid: '$pick',
          kw: '突撃',
          scope: 'turn',
          target: {
            kind: 'pick',
            query: {
              area: 'scene',
              side: 'self',
              filter: {
                cardName: '毛利小五郎',
                lpMin: 0,
                lpMax: 0
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
  description: '【FILE5】【宣言】【ターン1】【スリープ】：以下から1つ選んで行う。 ・手札を1枚リムーブしてもよい。そうした場合、レベル4以下のキャラを1枚まで選び、リムーブする。 ・手札を1枚リムーブしてもよい。そうした場合、自分の現場にいるLP0の〚カード名［毛利小五郎］〛を1枚まで選び、アクティブにする。 ・自分の現場にいるLP0の〚カード名［毛利小五郎］〛を1枚まで選び、ターン終了時まで〚突撃〛を与える。',
  ruleRefs: [
    'rules/21-declared-ability-cost.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/13-keywords.md',
    'rules/19-special-rules.md',
    'rules/03-field-areas.md'
  ]
};

export const PR205: CardDef = {
  id: 'PR205',
  no: '0833/PR205',
  kind: 'character',
  names: [
    '江戸川コナン'
  ],
  colors: [
    '青'
  ],
  level: 7,
  ap: 5000,
  lp: 1,
  traits: [
    '探偵',
    '毛利探偵事務所',
    '少年探偵団'
  ],
  rarity: 'PR',
  imageUrl: '1764290716064965.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/21-declared-ability-cost.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/13-keywords.md',
    'rules/19-special-rules.md',
    'rules/03-field-areas.md',
    'rules/11-reasoning.md'
  ],
};
