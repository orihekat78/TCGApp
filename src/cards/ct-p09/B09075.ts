// cards/ct-p09/B09075 宮本由美 (character) — Task A green候補 (engine変更0)
// rules: rules/15-abilities-effects.md, rules/17-icons.md, rules/19-special-rules.md, rules/21-declared-ability-cost.md, rules/03-field-areas.md
// 公式テキスト:
//   【解決編】【疾風】自分のリムーブエリアにあるレベル6以下の〚特徴［警察］〛のキャラを1枚まで選び、登場させる。（自分の現場にこのターンで1番に登場したときに発動する）\n【宣言】【スリープ】：〚特徴［警察］〛のキャラを1枚まで選び、ターン終了時までAP＋2000する。
// 句マッピング:
//   - 【解決編】 => ability.condition = {kind:'caseStatus', status:'解決編'} [caseStatus condition honored in cond/eval.ts per capability-map.txt L148 (owner's case status equals '事件編'|'解決編') and L566. Sits at ability level (sibling of trigger), gated AFTER matcherCondition in handleHook order (capability-map.txt L277). Exemplar src/cards/ct-d08/D08019.ts a1: triggered enter ability with condition:{kind:'caseStatus',status:'解決編'} — exact shape copied.]
//   - 【疾風】（自分の現場にこのターンで1番に登場したときに発動する） => trigger:{hook:'enter', selfOnly:true, matcherCondition:{kind:'enterOrderEquals', n:1}} [enter hook payload {uid,viaEffect,enterOrder,enterOrderThisTurn} (capability-map.txt L286-287). enterOrderEquals reads enterOrderThisTurn===n (turn-reset counter, NOT cumulative — BUG-100 noted) per capability-map.txt L183. 【疾風】=1番目に登場 → n:1. Exemplar src/cards/ct-d11/D11003.ts a1 and src/cards/ct-d11/D11014.ts a1 use VERBATIM {hook:'enter',selfOnly:true,matcherCondition:{kind:'enterOrderEquals',n:1}} with the identical parenthetical text 「自分の現場にこのターンで1番に登場したときに発動する」.]
//   - 自分のリムーブエリアにあるレベル6以下の〚特徴［警察］〛のキャラを1枚まで選び、登場させる => atom sceneEnter {player:'self', from:'remove', max:1, viaEffect:true, filter:{trait:'警察', levelMax:6, kind:'character'}} [sceneEnter from:'remove' short-form builds source-area pick ($pick.cardId) per capability-map.txt L33; max:1 → n:{min:0,max:1} (1枚まで, skip-OK / 0-target legal). filter on remove-area card candidates honored via matchOneFilter: trait (candidates.ts ~248-252 d?.traits), levelMax (candidates.ts ~294 printed level for c===null), kind ('character' candidates.ts ~273) — all confirmed honored on the remove-area path per B02053.ts a1 clauseMap and B07082.ts a1 clauseMap. Exemplar src/cards/ct-p07/B07082.ts a1 = bare sceneEnter{player:'self',from:'remove',max:1,viaEffect:true,filter:{cardName:'佐藤美和子',levelMax:5,kind:'character'}} inside a triggered enter ability (NO choice/target wrapper needed); src/cards/ct-p02/B02053.ts a1 grounds the trait-filter form {trait:'怪盗',levelMax:7,kind:'character'}. B09075 omits enterSleep because text says 「登場させる」 (not スリープ状態で登場). NO ⛔ gate: viaEffect bool is OK; no source-level/attribute enter filter.]
//   - 【宣言】【スリープ】： => type:'declared', cost:{kind:'sleepSelf'} [declared ability with cost sleepSelf — sleeps ctx.source.uid; payable ONLY if char is active (sleep/stun ⛔ unpayable, engine-enforced per capability-map.txt L380, rules/21). Exemplar src/cards/ct-d11/D11014.ts a2 (same character family 横溝重悟, level7/AP6000/警察) uses VERBATIM {type:'declared', scope:'on-scene', cost:{kind:'sleepSelf'}}.]
//   - 〚特徴［警察］〛のキャラを1枚まで選び、ターン終了時までAP＋2000する => atom charModifyAP {delta:2000, max:1, side:'either', filter:{trait:'警察'}, scope:'turn'} [charModifyAP PA short-form: uid absent + isShortFormDelta(delta) + max → PA pick (side='either', chooser=ctx.source.player) per capability-map.txt L42; max:1 → n:{min:0,max:1} (1枚まで, skip/0-pick legal). scope:'turn' = ターン終了時まで (turnEffects apMod_turn). 「キャラ」 with no 自分/相手 qualifier → side:'either' (rules/15 エリア指定なしの『キャラ』=どちらの現場). trait filter honored on scene-char pick via matchOneFilter (candidates.ts d?.traits). Exemplar src/cards/ct-p09/B09083.ts a1 = charModifyAP {delta:2000, max:1, side:'self', filter:{cardName:[...]}, scope:'turn'} — identical short-form shape (filter cardName→trait, side self→either per text). src/cards/ct-d11/D11014.ts a1 grounds the side:'either' + max:1 + scope:'turn' charModifyAP short-form.]

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  condition: {
    kind: 'caseStatus',
    status: '解決編'
  },
  trigger: {
    hook: 'enter',
    selfOnly: true,
    matcherCondition: {
      kind: 'enterOrderEquals',
      n: 1
    }
  },
  effect: {
    kind: 'atom',
    verb: 'sceneEnter',
    args: {
      player: 'self',
      from: 'remove',
      max: 1,
      viaEffect: true,
      filter: {
        trait: '警察',
        levelMax: 6,
        kind: 'character'
      }
    }
  },
  description: '【解決編】【疾風】自分のリムーブエリアにあるレベル6以下の〚特徴［警察］〛のキャラを1枚まで選び、登場させる。（自分の現場にこのターンで1番に登場したときに発動する）',
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/19-special-rules.md',
    'rules/03-field-areas.md'
  ]
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'declared',
  scope: 'on-scene',
  cost: {
    kind: 'sleepSelf'
  },
  effect: {
    kind: 'atom',
    verb: 'charModifyAP',
    args: {
      delta: 2000,
      max: 1,
      side: 'either',
      filter: {
        trait: '警察'
      },
      scope: 'turn'
    }
  },
  description: '【宣言】【スリープ】：〚特徴［警察］〛のキャラを1枚まで選び、ターン終了時までAP＋2000する。',
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md'
  ]
};

export const B09075: CardDef = {
  id: 'B09075',
  no: '1015/B09075',
  kind: 'character',
  names: [
    '宮本由美'
  ],
  colors: [
    '黄'
  ],
  level: 7,
  ap: 6000,
  lp: 1,
  traits: [
    '警察',
    '警視庁'
  ],
  rarity: 'R',
  imageUrl: '1775608910262633.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/19-special-rules.md',
    'rules/21-declared-ability-cost.md',
    'rules/03-field-areas.md'
  ],
};
