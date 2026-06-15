// cards/ct-p05/B05006 毛利小五郎 (character) — Task A green候補 (engine変更0)
// rules: rules/13-keywords.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/21-declared-ability-cost.md, rules/24-qa-naming-stun.md
// 公式テキスト:
//   【パートナー青】【宣言】【ターン1】このキャラがアクティブ状態の場合、ターン終了時までこのキャラは〚突撃〛（登場したターンからすぐにアクションできる）を持つ。スリープ状態かスタン状態の場合、AP8000以下のキャラを1枚まで選び、リムーブし、カードを1枚引く。この能力は自分の現場に〚カード名［妃英理］〛かこのキャラ以外の〚特徴［毛利探偵事務所］〛のキャラがいる場合に宣言できる。
// 句マッピング:
//   - 【パートナー青】 => ability.condition[0] = {kind 'partnerColor', color:'青'} [B04049 a1 uses condition partnerColor '赤'; cond/eval.ts partnerColor = owner partner CardDef.colors intersects color. canDeclaredAbility (declared-ability.ts BUG-099) evaluates ability.condition to gate declaration, so 【パートナー色】 belongs in ability.condition.]
//   - 【宣言】 => AbilityDef.type = 'declared', scope 'on-scene' [B05066 a2 = cost-less declared ability {type 'declared', scope 'on-scene', limit, effect} with no cost field; B07034 a2 = declared with cost. useDeclaredAbility (declared-ability.ts) queues ability.effect for type 'declared'.]
//   - 【ターン1】 => ability.limit = {kind 'turn', n:1} [B05066 a2 / B07034 a2 / D02013 use limit:{kind 'turn',n:1}; canDeclaredAbility enforces readChar.declaredUseCount < limit.n (BUG-067).]
//   - この能力は自分の現場に〚カード名［妃英理］〛か…がいる場合に宣言できる (妃英理 branch) => ability.condition.or[0] = sceneHas{query:{area:'scene', side:'self', filter:{cardName:'妃英理'}}, nMin:1} [D02013 condition = sceneHas gating declaration ('この能力は…場合に宣言できる'). candidates.ts matchOneFilter lines 260-265 honor filter.cardName (split-name via allCardNameComponentsForDef) on scene chars. side:'self' = own scene (B04035/D11003/D11021). No excludeSelf because this card is 毛利小五郎, not 妃英理.]
//   - …かこのキャラ以外の〚特徴［毛利探偵事務所］〛のキャラがいる場合に宣言できる (毛利探偵事務所 branch) => ability.condition.or[1] = sceneHas{query:{area:'scene', side:'self', filter:{trait:'毛利探偵事務所'}, excludeSelf:true}, nMin:1} [B04035 a1 exact pattern: '自分の現場にこのキャラ以外の[マジシャン]がいる場合' = sceneHas{query:{area:'scene', side:'self', filter:{trait:'マジシャン'}, excludeSelf:true}, nMin:1}. excludeSelf needed because 毛利小五郎 itself has trait 毛利探偵事務所 (features 探偵|毛利探偵事務所). Two sceneHas combined with or{cs:[...]} (different excludeSelf semantics per branch prevent merging into one filterAny query). or condition in union (cond/eval.ts).]
//   - このキャラがアクティブ状態の場合、ターン終了時までこのキャラは〚突撃〛を持つ => effect.sequence[0] = conditional{if:charStateIs{ref:self,state:'active'}, then:charGrantKeyword{uid:'$self', kw:'突撃', scope 'turn'}} [charStateIs condition (effect.ts:54 union state:'active'|'sleep'|'stun'; cond/eval.ts:215-218 charRead.state(uid)===cond.state; CONDITION_HANDLED map line 381 true). B04049 a1 uses charStateIs{ref:{kind 'self'},state:'sleep'}. 突撃 grant: D06006 a1 (identical official gloss '登場したターンからすぐにアクションできる') = charGrantKeyword{uid:'$self', kw:'突撃', scope 'turn'} (capability-map charGrantKeyword honors arbitrary kw string + scope).]
//   - スリープ状態かスタン状態の場合、… (state gate) => effect.sequence[1].if = or{cs:[charStateIs{ref:self,state:'sleep'}, charStateIs{ref:self,state:'stun'}]} [charStateIs supports 'sleep' and 'stun' literals (effect.ts:54). resolveCharsForRef (cond/eval.ts:402) resolves ref:{kind 'self'} via resolveTarget to ctx.source.uid; in declared flow resolveCtx.source.uid = declaring char uid (declared-ability.ts useDeclaredAbility). or combinator in union. Mutually exclusive with the active branch (a char is exactly one state).]
//   - AP8000以下のキャラを1枚まで選び、リムーブし、 => effect.sequence[1].then.sequence[0] = atom sceneRemove{player:'self', max:1, side:'either', cause:'effect', filter:{apMax:8000}} [B04049 a1 / D08003 a1 use sceneRemove{player:'self', max:1, side:'either', cause:'effect', filter:{apMax:8000}} for 'AP8000以下のキャラを1枚までリムーブ'. capability-map: sceneRemove short-form PA pick, max:1 = 0..1 (n.min:0 '〜枚まで' rules/15, 0-pick legal). apMax honored on scene pick path (effective AP). side:'either' = どちらの現場でも (rules/15 エリア指定なし).]
//   - カードを1枚引く => effect.sequence[1].then.sequence[1] = atom draw{player:'self', n:1} [B04036 a1 draw{player:'self', n:1}. Placed in sequence (NOT chain) so draw runs unconditionally even when 0 chars removed — text is 'リムーブし、カードを1枚引く' (連用形 し, both 'する' mandatory, no 'そうした場合'). capability-map: sequence runs all steps; chain breaks on no-candidate.]
//   - vanilla stats / no innate printed keyword => keywords:[] (突撃 is GRANTED via effect, not printed) [Card record keywords absent; 突撃 appears only as a granted effect (charGrantKeyword scope turn). Per brief keywords[] = printed innate only; granted keywords excluded.]

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'declared',
  scope: 'on-scene',
  limit: {
    kind: 'turn',
    n: 1
  },
  condition: {
    kind: 'and',
    cs: [
      {
        kind: 'partnerColor',
        color: '青'
      },
      {
        kind: 'or',
        cs: [
          {
            kind: 'sceneHas',
            query: {
              area: 'scene',
              side: 'self',
              filter: {
                cardName: '妃英理'
              }
            },
            nMin: 1
          },
          {
            kind: 'sceneHas',
            query: {
              area: 'scene',
              side: 'self',
              filter: {
                trait: '毛利探偵事務所'
              },
              excludeSelf: true
            },
            nMin: 1
          }
        ]
      }
    ]
  },
  effect: {
    kind: 'sequence',
    steps: [
      {
        kind: 'conditional',
        if: {
          kind: 'charStateIs',
          ref: {
            kind: 'self'
          },
          state: 'active'
        },
        then: {
          kind: 'atom',
          verb: 'charGrantKeyword',
          args: {
            uid: '$self',
            kw: '突撃',
            scope: 'turn'
          }
        }
      },
      {
        kind: 'conditional',
        if: {
          kind: 'or',
          cs: [
            {
              kind: 'charStateIs',
              ref: {
                kind: 'self'
              },
              state: 'sleep'
            },
            {
              kind: 'charStateIs',
              ref: {
                kind: 'self'
              },
              state: 'stun'
            }
          ]
        },
        then: {
          kind: 'sequence',
          steps: [
            {
              kind: 'atom',
              verb: 'sceneRemove',
              args: {
                player: 'self',
                max: 1,
                side: 'either',
                cause: 'effect',
                filter: {
                  apMax: 8000
                }
              }
            },
            {
              kind: 'atom',
              verb: 'draw',
              args: {
                player: 'self',
                n: 1
              }
            }
          ]
        }
      }
    ]
  },
  description: '【パートナー青】【宣言】【ターン1】このキャラがアクティブ状態の場合、ターン終了時までこのキャラは〚突撃〛（登場したターンからすぐにアクションできる）を持つ。スリープ状態かスタン状態の場合、AP8000以下のキャラを1枚まで選び、リムーブし、カードを1枚引く。この能力は自分の現場に〚カード名［妃英理］〛かこのキャラ以外の〚特徴［毛利探偵事務所］〛のキャラがいる場合に宣言できる。',
  ruleRefs: [
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md',
    'rules/24-qa-naming-stun.md'
  ]
};

export const B05006: CardDef = {
  id: 'B05006',
  no: '0512/B05006',
  kind: 'character',
  names: [
    '毛利小五郎'
  ],
  colors: [
    '青'
  ],
  level: 8,
  ap: 8000,
  lp: 0,
  traits: [
    '探偵',
    '毛利探偵事務所'
  ],
  rarity: 'SR',
  imageUrl: '1743742488525995.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md',
    'rules/24-qa-naming-stun.md'
  ],
};
