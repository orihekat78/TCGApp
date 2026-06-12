// cards/ct-p08/B08052 イーサン・本堂 (character) — Task A green候補 (engine変更0)
// rules: rules/21-declared-ability-cost.md, rules/15-abilities-effects.md, rules/16-card-set.md, rules/19-special-rules.md, rules/20-color-and-switch.md
// 公式テキスト:
//   【宣言】〚デッキの下に移す〛：以下から1つ選んで行う。\n・レベル5以下の【黒】のキャラを1枚まで選び、リムーブする。\n・自分のリムーブエリアにある〚カード名［本堂瑛海］〛か〚［本堂瑛祐］〛を1枚まで選び、手札に加える。
// 句マッピング:
//   - 【宣言】(declared ability on a scene character) => type:'declared', scope:'on-scene' [D11012 a1 (src/cards/ct-d11/D11012.ts) and B05098 a1 (src/cards/ct-p05/B05098.ts) both use type:'declared'+scope:'on-scene' for a 宣言 char ability. capability-map §3 'declared' = player-declared, cost paid then runs effect; usable from scene chars (rules/21).]
//   - 〚デッキの下に移す〛 (cost: move this char to deck bottom) => cost:{kind:'selfToDeckBottom'} [EXACT match D11012 a1 + B05098 a1 + B03011 a1 cost:{kind:'selfToDeckBottom'}. Engine wired: src/engine/cost/evaluate.ts case 'selfToDeckBottom' (payable while char exists; no sleep icon → rules/21 payable even sleeping), src/engine/cost/pay.ts moves ctx.source.uid char to deck bottom. capability-map §1 'selfToDeckBottom'.]
//   - 以下から1つ選んで行う (choose 1 of the 2 listed effects) => effect:{kind:'choice', chooser:'self', options:[A,B]} [EXACT structural match D11012 a1 effect:{kind:'choice',chooser:'self',options:[...]} as a declared effect. capability-map 'choice {options,chooser}' — humanChooser + options.length>1 + chooser!=='opp' surfaces __pendingEffectChoiceSide modal; AI/single-option default index 0. validate.walk requires ≥1 option (we have 2).]
//   - レベル5以下の【黒】のキャラを1枚まで選び、リムーブする => atom sceneRemove {player:'self', max:1, side:'either', cause:'effect', filter:{levelMax:5, color:'黒'}} [Pattern from B09101 a1 (src/cards/ct-p09/B09101.ts) sceneRemove{player:'self',max:1,side:'either',cause:'effect',filter:{levelMax:7}} = 「レベル7以下のキャラを1枚まで選び、リムーブする」. color filter honored on scene-char picks via matchOneFilter (src/engine/target/candidates.ts line ~256-261, membership-OR on CardDef.colors). levelMax honored (candidates.ts line ~296, level合算; scene chars use mods). side:'either' (no エリア指定 → どちらの現場でも, rules/15) matches B09101. '1枚まで'→max:1 (0-pick legal, capability-map nMin/legalCount). cause:'effect' = ability removal (rules/15).]
//   - 自分のリムーブエリアにある〚カード名［本堂瑛海］〛か〚［本堂瑛祐］〛を1枚まで選び、手札に加える => atom handAddFromRemove {player:'self', max:1, filter:{cardName:['本堂瑛海','本堂瑛祐']}} [Pattern from B05098 a1 (handAddFromRemove{player:'self',max:1,filter:{...}}) and D11012 a2 (handAddFromRemove{player:'self',max:1,filter:{cardName:'萩原千速'}}). 'X か Y' → cardName array honored by matchOneFilter (candidates.ts line ~232-237, split-name via allCardNameComponentsForDef, wants.some). Short-form Pattern B defaultArea='remove' (capability-map handAddFromRemove). '1枚まで'→max:1 (0-pick legal). player:'self'='自分のリムーブエリア'.]

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'declared',
  scope: 'on-scene',
  cost: {
    kind: 'selfToDeckBottom'
  },
  effect: {
    kind: 'choice',
    chooser: 'self',
    options: [
      {
        kind: 'atom',
        verb: 'sceneRemove',
        args: {
          player: 'self',
          max: 1,
          side: 'either',
          cause: 'effect',
          filter: {
            levelMax: 5,
            color: '黒'
          }
        }
      },
      {
        kind: 'atom',
        verb: 'handAddFromRemove',
        args: {
          player: 'self',
          max: 1,
          filter: {
            cardName: [
              '本堂瑛海',
              '本堂瑛祐'
            ]
          }
        }
      }
    ]
  },
  description: '【宣言】〚デッキの下に移す〛：以下から1つ選んで行う。 ・レベル5以下の【黒】のキャラを1枚まで選び、リムーブする。 ・自分のリムーブエリアにある〚カード名［本堂瑛海］〛か〚［本堂瑛祐］〛を1枚まで選び、手札に加える。',
  ruleRefs: [
    'rules/21-declared-ability-cost.md',
    'rules/15-abilities-effects.md',
    'rules/16-card-set.md',
    'rules/20-color-and-switch.md'
  ]
};

export const B08052: CardDef = {
  id: 'B08052',
  no: '0890/B08052',
  kind: 'character',
  names: [
    'イーサン・本堂'
  ],
  colors: [
    '赤'
  ],
  level: 4,
  ap: 4000,
  lp: 1,
  traits: [
    'CIA'
  ],
  rarity: 'C',
  imageUrl: '1770731238631560.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/21-declared-ability-cost.md',
    'rules/15-abilities-effects.md',
    'rules/16-card-set.md',
    'rules/19-special-rules.md',
    'rules/20-color-and-switch.md'
  ],
};
