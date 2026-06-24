// cards/ct-p04/B04019 服部平蔵 (character) — Task A green候補 (engine変更0)
// rules: rules/15-abilities-effects.md, rules/17-icons.md, rules/20-color-and-switch.md, rules/21-declared-ability-cost.md
// 公式テキスト:
//   【宣言】【ターン1】〚現場にいるレベル7以上のカード名［服部平次］か、このキャラ以外のレベル7以上の特徴［警察］のキャラを1枚デッキの下に移す〛：AP8000以下のキャラを1枚まで選び、リムーブする。自分のリムーブエリアにあるレベル5以下の〚特徴［警察］〛のキャラを1枚まで選び、スリープ状態で登場させる。
// 句マッピング:
//   - 【宣言】【ターン1】 => AbilityDef{type 'declared', scope 'on-scene', limit:{kind 'turn',n:1}} [B03059.ts a1 / B07079.ts a1: declared + scope 'on-scene' + limit:{kind 'turn',n:1}. AbilityType 'declared' confirmed in src/engine/types/card-def.ts:15; limit field in AbilityDef (card-def.ts:126).]
//   - 〚現場にいるレベル7以上のカード名［服部平次］か、このキャラ以外のレベル7以上の特徴［警察］のキャラを1枚デッキの下に移す〛 (コスト) => cost{kind 'sceneToDeckBottom', target:{pick scene side:self excludeSelf:true filter:{levelMin:7,kind character} filterAny:[{cardName:服部平次},{trait:警察}]}, n:1} [sceneToDeckBottom cost kind exists: src/engine/cost/evaluate.ts:16 COST_KIND_MAP + types/effect.ts:235 {kind,target:TargetingRef,n}. B07079.ts a1 cost uses pay[sleepSelf, sceneToDeckBottom{query:{area:'scene',side:'self',filter:{levelMax:7,trait:'警視庁'}},n:1}] (same '現場にいる…を1枚デッキの下に移す' cost; side:'self' per rules/21 自分の省略). pay.ts:79 routes via pickCandidates→candidates. Cross-field OR via filterAny: candidates.ts:245-247 matchesFilters = AND(filter)∧OR(filterAny) (effect.ts:140 TargetQuery.filterAny). excludeSelf: candidates.ts:211 removes ctx.source.uid only — equivalent to 'このキャラ以外' applying to 警察 branch only because this card (服部平蔵) is not named 服部平次 so branch1 never includes self. levelMin honored at candidates.ts:336 via effective level.]
//   - AP8000以下のキャラを1枚まで選び、リムーブする => atom sceneRemove{player:'self', max:1, side:'either', filter:{apMax:8000}, cause:'effect'} [EXACT copy of B07079.ts a1 effect step1: sceneRemove{player:'self', max:1, side:'either', filter:{apMax:8000}, cause:'effect'}. sceneRemove in ATOM_VERB_MAP (validate.ts:28). apMax honored on effective AP (candidates.ts:330). 'side指定なし'=either (rules/15 どちらの現場でも). max:1 = 0〜1枚 (rules/15 〜まで).]
//   - 自分のリムーブエリアにあるレベル5以下の〚特徴［警察］〛のキャラを1枚まで選び、スリープ状態で登場させる => atom sceneEnter{player:'self', from:'remove', max:1, viaEffect:true, enterSleep:true, filter:{trait:'警察', levelMax:5, kind 'character'}} [D05006.ts a1 step2: sceneEnter{player:'self', from:'remove', max:1, viaEffect:true, enterSleep:true, filter:{color:'黄', levelMax:4, kind 'character'}} (same 'リムーブエリアにあるレベルN以下の…キャラを1枚まで選び、スリープ状態で登場させる'; color→trait swap). sceneEnter in ATOM_VERB_MAP (validate.ts:28); from:'remove' source-area splice + enterSleep + viaEffect documented in cap-map L33. max:1=0〜1可 (rules/15). viaEffect 登場=色制限なし (rules/20).]
//   - 2効果の連結 (リムーブする。…登場させる。) => effect{kind 'sequence', steps:[sceneRemove, sceneEnter]} [B07079.ts a1 effect uses kind 'sequence' for two mandatory sequential steps. Both are 「〜まで選び…する」(必須実行だが0枚選択可). No 「そうした場合」 dependency between them → sequence (not chain).]

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'declared',
  scope: 'on-scene',
  limit: {
    kind: 'turn',
    n: 1
  },
  cost: {
    kind: 'sceneToDeckBottom',
    target: {
      kind: 'pick',
      query: {
        area: 'scene',
        side: 'self',
        excludeSelf: true,
        filter: {
          levelMin: 7,
          kind: 'character'
        },
        filterAny: [
          {
            cardName: '服部平次'
          },
          {
            trait: '警察'
          }
        ]
      },
      n: {
        min: 1,
        max: 1
      },
      chooser: 'owner'
    },
    n: 1
  },
  effect: {
    kind: 'sequence',
    steps: [
      {
        kind: 'atom',
        verb: 'sceneRemove',
        args: {
          player: 'self',
          max: 1,
          side: 'either',
          filter: {
            apMax: 8000
          },
          cause: 'effect'
        }
      },
      {
        kind: 'atom',
        verb: 'sceneEnter',
        args: {
          player: 'self',
          from: 'remove',
          max: 1,
          viaEffect: true,
          enterSleep: true,
          filter: {
            trait: '警察',
            levelMax: 5,
            kind: 'character'
          }
        }
      }
    ]
  },
  description: '【宣言】【ターン1】〚現場にいるレベル7以上のカード名［服部平次］か、このキャラ以外のレベル7以上の特徴［警察］のキャラを1枚デッキの下に移す〛：AP8000以下のキャラを1枚まで選び、リムーブする。自分のリムーブエリアにあるレベル5以下の〚特徴［警察］〛のキャラを1枚まで選び、スリープ状態で登場させる。',
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/20-color-and-switch.md',
    'rules/21-declared-ability-cost.md'
  ]
};

export const B04019: CardDef = {
  id: 'B04019',
  no: '0420/B04019',
  kind: 'character',
  names: [
    '服部平蔵'
  ],
  colors: [
    '緑'
  ],
  level: 8,
  ap: 7000,
  lp: 2,
  traits: [
    '警察',
    '大阪府警'
  ],
  rarity: 'R',
  imageUrl: '1735287737387969.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/20-color-and-switch.md',
    'rules/21-declared-ability-cost.md'
  ],
};
