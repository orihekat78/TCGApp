// cards/ct-p09/B09082 知苑禄江 (character) — Task A green候補 (engine変更0)
// rules: rules/15-abilities-effects.md, rules/17-icons.md, rules/21-declared-ability-cost.md, rules/24-qa-naming-stun.md, rules/03-field-areas.md
// 公式テキスト:
//   【宣言】【スリープ】〚現場にいるカード名［知苑大哉］を1枚スリープさせる〛：レベル8以下のキャラを1枚まで選び、スタンさせる。（スタン状態のキャラをアクティブにする場合、代わりにスリープさせる）
// 句マッピング:
//   - 【宣言】 => AbilityDef type:'declared', scope:'on-scene' [src/cards/ct-p03/B03060.ts a1 (declared char ability scope:'on-scene'); capability-map §3 declared type]
//   - 【スリープ】 (cost: このキャラをスリープ) => cost.pay item {kind:'sleepSelf'} [src/cards/ct-p05/B05074.ts a2 & src/cards/ct-p03/B03060.ts a1 cost.pay items[0]={kind:'sleepSelf'}; src/engine/cost/evaluate.ts:20-23 sleepSelf payable only if active (rules/21); src/engine/cost/pay.ts:38-40 mutate.scene.setState ...'sleep']
//   - 〚現場にいるカード名［知苑大哉］を1枚スリープさせる〛 (cost) => cost.pay item {kind:'sleepChar', target:{kind:'pick', query:{area:'scene', side:'self', filter:{cardName:'知苑大哉'}}, n:{min:1,max:1}, chooser:'self'}} [src/cards/ct-p04/B04070.ts a2 (現場にいるカード名［佐藤美和子］を1枚スリープ = sleepChar scene/side:self/filter:{cardName} pick) and src/cards/ct-p05/B05074.ts a2 (現場にいるカード名［大橋彩代］, identical structure); src/engine/cost/evaluate.ts:25-27 sleepChar payable iff ≥1 active candidate (cost gate, rules/21); src/engine/target/candidates.ts:239-243 cardName honored via matchOneFilter (split-name aware)]
//   - レベル8以下のキャラを1枚まで選び、スタンさせる => effect atom sceneSetState short-form {player:'self', max:1, side:'either', state:'stun', filter:{levelMax:8}} [src/cards/ct-p03/B03060.ts a1 (レベル7以下のキャラを1枚まで選び、スタンさせる = sceneSetState {player:'self',max:1,side:'either',state:'stun',filter:{levelMax:7}}; differs only levelMax 7→8); src/engine/effect/atom-handlers.ts:788-798 sceneSetState short-form (uid absent + player + state string + n|max → scene pick, side default 'either'); src/engine/effect/atom-pick-spec.ts:36 sceneSetState PA needs:'state' & buildShortFormPick passes filter (levelMax) + max→n:{min:0,max:1} (1枚まで=0OK)]
//   - （スタン状態のキャラをアクティブにする場合、代わりにスリープさせる） => rules/03 standard stun reminder — engine-handled automatically (mutate.scene.setState), description-only, no separate impl [src/cards/ct-p03/B03060.ts a1 carries the identical parenthetical as description text with no separate ability; rules/03-field-areas.md スタン状態の特殊挙動 / rules/24-qa-naming-stun.md]

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
        kind: 'sleepChar',
        target: {
          kind: 'pick',
          query: {
            area: 'scene',
            side: 'self',
            filter: {
              cardName: '知苑大哉'
            }
          },
          n: {
            min: 1,
            max: 1
          },
          chooser: 'self'
        }
      }
    ]
  },
  effect: {
    kind: 'atom',
    verb: 'sceneSetState',
    args: {
      player: 'self',
      max: 1,
      side: 'either',
      state: 'stun',
      filter: {
        levelMax: 8
      }
    }
  },
  description: '【宣言】【スリープ】〚現場にいるカード名［知苑大哉］を1枚スリープさせる〛：レベル8以下のキャラを1枚まで選び、スタンさせる。（スタン状態のキャラをアクティブにする場合、代わりにスリープさせる）',
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md',
    'rules/24-qa-naming-stun.md',
    'rules/03-field-areas.md'
  ]
};

export const B09082: CardDef = {
  id: 'B09082',
  no: '1022/B09082',
  kind: 'character',
  names: [
    '知苑禄江'
  ],
  colors: [
    '黄'
  ],
  level: 6,
  ap: 6000,
  lp: 0,
  traits: [],
  rarity: 'C',
  imageUrl: '1775608910349200.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md',
    'rules/24-qa-naming-stun.md',
    'rules/03-field-areas.md'
  ],
};
