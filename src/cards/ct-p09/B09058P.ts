// cards/ct-p09/B09058P 羽田秀𠮷 (character) — Task A green候補 (engine変更0)
// rules: rules/15-abilities-effects.md, rules/17-icons.md, rules/20-color-and-switch.md, rules/03-field-areas.md, rules/21-declared-ability-cost.md
// 公式テキスト:
//   【登場時】このキャラをスリープさせ、手札を1枚リムーブしてもよい。そうした場合、自分のリムーブエリアにあるレベル6以下の〚特徴［赤井家］〛のキャラを1枚まで選び、登場させる。\n【宣言】【ターン1】〚このキャラ以外の特徴［赤井家］のキャラを1枚スリープさせる〛：カードを1枚引く。
// 句マッピング:
//   - 【登場時】 (発動タイミング) => type:'triggered', scope:'on-scene', trigger:{hook:'enter', selfOnly:true} [hook 'enter' (【登場時】, selfOnly via source.uid) per capability-map.txt §B; exact shape from src/cards/ct-p01/B01011.ts a1 and src/cards/ct-d08/D08003.ts a1; identical template in src/cards/pr-01/PR144.ts a1.]
//   - このキャラをスリープさせ (任意行為の前段) => chain step1: atom sceneSetState {uid:'$self', state:'sleep'} [sceneSetState {uid:'$self',state:'sleep'} per capability-map.txt Scene verbs; exact arg shape from src/cards/ct-p01/B01011.ts a1 ('このキャラはスリープ状態で登場') and src/cards/pr-01/PR144.ts a1 step0 (same clause).]
//   - 手札を1枚リムーブしてもよい (任意) => optional wrapper enclosing chain; chain step2: atom discard {player:'self', n:1} [optional wrapper per certify-brief 「〜してもよい。そうした場合」 + capability-map §C optional; discard {player,n} per capability-map Draw/FILE verbs (Pattern B short-form defaultArea=hand). Identical clause+shape in src/cards/pr-01/PR144.ts a1 (optional{chain[sceneSetState$self, discard n:1, sceneEnter]}) and src/cards/ct-p06/B06052.ts a1 (optional{chain[discard n:1, sceneEnter from remove]}).]
//   - そうした場合 (条件接続) => chain semantics: discard 無候補(手札0) → __chainStepNoApply → 後続 sceneEnter skip [chain 「そうした場合」semantics (no-candidate step breaks chain) per capability-map §C and src/engine/effect/resolver.ts chain handling; established convention in src/cards/ct-d08/D08003.ts a1 and src/cards/pr-01/PR144.ts a1.]
//   - 自分のリムーブエリアにあるレベル6以下の〚特徴［赤井家］〛のキャラを1枚まで選び、登場させる => chain step3: atom sceneEnter {player:'self', from:'remove', max:1, viaEffect:true, filter:{trait:'赤井家', levelMax:6, kind:'character'}} [sceneEnter from:'remove' reanimate per capability-map Scene verbs; exact arg shape (player/from:remove/max/viaEffect/filter trait+levelMax+kind) from src/cards/ct-p02/B02053.ts a1 and src/cards/pr-01/PR144.ts a1 (same trait+levelMax:6 template). trait/levelMax/kind filters honored on remove-area card candidates verified in src/engine/target/candidates.ts (case 'remove' → matchesFiltersByCardId → matchOneFilter: filter.trait via d?.traits, filter.kind via d?.kind===filter.kind, filter.levelMax via base?.level for c===null).]
//   - 【宣言】 (宣言能力) => type:'declared' [declared ability per capability-map §3 AbilityTypes; exemplar src/cards/ct-d01/D01003.ts a1.]
//   - 【ターン1】 (回数制限) => limit:{kind:'turn', n:1} [limit turn:1 per capability-map §B (declaredUseCount per uid+abilityId); exemplar src/cards/ct-d01/D01003.ts a1 and src/cards/ct-p07/B07016.ts a2.]
//   - 〚このキャラ以外の特徴［赤井家］のキャラを1枚スリープさせる〛 (コスト) => cost:{kind:'sleepChar', target:{kind:'pick', query:{area:'scene', side:'self', excludeSelf:true, filter:{trait:'赤井家'}}, n:{min:1,max:1}, chooser:'self'}} [sleepChar cost (rules/21 自分の省略 → side:'self'+excludeSelf) per capability-map §1 Cost kinds; cost evaluated via candidates() honoring filter — verified src/engine/cost/evaluate.ts (canPay sleepChar → candidates(cost.target)) + src/engine/cost/pay.ts. excludeSelf+filter:{trait} on cost pick proven in src/cards/ct-p03/B03060.ts a1 (filter:{trait:'探偵'}) and src/cards/ct-p07/B07016.ts a2 (filter:{levelMin:5}); base shape src/cards/ct-d01/D01003.ts a1. excludeSelf+trait honored in src/engine/target/candidates.ts matchesQueryForChar + matchOneFilter.]
//   - ：カードを1枚引く (効果) => effect: atom draw {player:'self', n:1} [draw {player,n} per capability-map Draw verbs (requireField throws if n not number); ubiquitous, e.g. src/cards/ct-d01/D01003.ts a1 step0, src/cards/ct-d08/D08003.ts a2.]

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: {
    hook: 'enter',
    selfOnly: true
  },
  effect: {
    kind: 'optional',
    effect: {
      kind: 'chain',
      steps: [
        {
          kind: 'atom',
          verb: 'sceneSetState',
          args: {
            uid: '$self',
            state: 'sleep'
          }
        },
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
          verb: 'sceneEnter',
          args: {
            player: 'self',
            from: 'remove',
            max: 1,
            viaEffect: true,
            filter: {
              trait: '赤井家',
              levelMax: 6,
              kind: 'character'
            }
          }
        }
      ]
    }
  },
  description: '【登場時】このキャラをスリープさせ、手札を1枚リムーブしてもよい。そうした場合、自分のリムーブエリアにあるレベル6以下の〚特徴［赤井家］〛のキャラを1枚まで選び、登場させる。',
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/20-color-and-switch.md',
    'rules/03-field-areas.md'
  ]
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'declared',
  scope: 'on-scene',
  limit: {
    kind: 'turn',
    n: 1
  },
  cost: {
    kind: 'sleepChar',
    target: {
      kind: 'pick',
      query: {
        area: 'scene',
        side: 'self',
        excludeSelf: true,
        filter: {
          trait: '赤井家'
        }
      },
      n: {
        min: 1,
        max: 1
      },
      chooser: 'self'
    }
  },
  effect: {
    kind: 'atom',
    verb: 'draw',
    args: {
      player: 'self',
      n: 1
    }
  },
  description: '【宣言】【ターン1】〚このキャラ以外の特徴［赤井家］のキャラを1枚スリープさせる〛：カードを1枚引く。',
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/21-declared-ability-cost.md',
    'rules/17-icons.md'
  ]
};

export const B09058P: CardDef = {
  id: 'B09058P',
  no: '1000/B09058P',
  kind: 'character',
  names: [
    '羽田秀𠮷'
  ],
  colors: [
    '赤'
  ],
  level: 7,
  ap: 6000,
  lp: 1,
  traits: [
    '棋士',
    '赤井家'
  ],
  rarity: 'RP',
  imageUrl: '1775608872797173.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/20-color-and-switch.md',
    'rules/03-field-areas.md',
    'rules/21-declared-ability-cost.md'
  ],
};
