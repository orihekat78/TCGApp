// cards/ct-p02/B02077P 安室透 (character) — Task A green候補 (engine変更0)
// rules: rules/15-abilities-effects.md, rules/17-icons.md, rules/03-field-areas.md, rules/20-color-and-switch.md
// 公式テキスト:
//   【登場時】自分の現場にこのキャラ以外のレベル7以上の〚特徴［探偵］〛のキャラがいる場合、自分のリムーブエリアにあるレベル5以下の〚特徴［探偵］〛のキャラを1枚まで選び、スリープ状態で登場させる。
// 句マッピング:
//   - 【登場時】 => trigger { hook 'enter', selfOnly:true } (type 'triggered', scope 'on-scene') [B02074.ts a1 / B07021.ts a2 / D08019.ts a1 all use trigger {hook 'enter',selfOnly:true} for 【登場時】. eval/resolver source for enter-hook = entering card (BUG-146 brief note).]
//   - 自分の現場にこのキャラ以外のレベル7以上の〚特徴［探偵］〛のキャラがいる場合 (条件ゲート) => conditional.if = sceneHas{ query:{ area:'scene', side:'self', filter:{ trait:'探偵', levelMin:7, kind 'character' }, excludeSelf:true }, nMin:1 } [B02074.ts:21 maps 「現場にこのキャラ以外の[警察]がいる場合」 to sceneHas{query:{area:'scene',side:'self',filter:{trait:'警察'},excludeSelf:true},nMin:1}. B09014.ts:24 proves levelMin inside same sceneHas filter with excludeSelf. Engine: cond/eval.ts:91-94 sceneHas -> candidates({kind 'all',query},ctx) count>=nMin; candidates.ts:205 excludeSelf excludes cand.uid===ctx.source.uid (= entering card); candidates.ts:320 levelMin honored. trait '探偵' value confirmed in B03060.ts:24.]
//   - 自分のリムーブエリアにあるレベル5以下の〚特徴［探偵］〛のキャラを1枚まで選び、スリープ状態で登場させる (条件成立時の効果) => conditional.then = atom sceneEnter{ player:'self', from:'remove', max:1, viaEffect:true, enterSleep:true, filter:{ trait:'探偵', levelMax:5, kind 'character' } } [B06052.ts a1 and D05006.ts a1 use the IDENTICAL sceneEnter shape {player:'self',from:'remove',max:1,viaEffect:true,enterSleep:true,filter:{trait/color,levelMax,kind 'character'}} for 「リムーブのレベルN以下の[特徴]キャラを1枚までスリープ状態で登場」. cap-map line33 confirms sceneEnter from+max short-form builds source-area pick ($pick.cardId) Pattern B; brief: hand/remove/deck pick requires kind 'character' (BUG-123). '1枚まで'=max:1 (0枚可). Effect is 必須 (not 「してもよい」) -> bare conditional.then, no optional wrapper (rules/15).]
//   - cutIn / hirameki / henso => none (all empty in record) [.tmp/taskA/recs/B02077.json: cutIn/hirameki/henso all empty strings -> single ability a1.]

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
    kind: 'conditional',
    if: {
      kind: 'sceneHas',
      query: {
        area: 'scene',
        side: 'self',
        filter: {
          trait: '探偵',
          levelMin: 7,
          kind: 'character'
        },
        excludeSelf: true
      },
      nMin: 1
    },
    then: {
      kind: 'atom',
      verb: 'sceneEnter',
      args: {
        player: 'self',
        from: 'remove',
        max: 1,
        viaEffect: true,
        enterSleep: true,
        filter: {
          trait: '探偵',
          levelMax: 5,
          kind: 'character'
        }
      }
    }
  },
  description: '【登場時】自分の現場にこのキャラ以外のレベル7以上の〚特徴［探偵］〛のキャラがいる場合、自分のリムーブエリアにあるレベル5以下の〚特徴［探偵］〛のキャラを1枚まで選び、スリープ状態で登場させる。',
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/03-field-areas.md',
    'rules/20-color-and-switch.md'
  ]
};

export const B02077P: CardDef = {
  id: 'B02077P',
  no: '0238/B02077P',
  kind: 'character',
  names: [
    '安室透'
  ],
  colors: [
    '黄'
  ],
  level: 7,
  ap: 6000,
  lp: 1,
  traits: [
    '探偵',
    '喫茶ポアロ'
  ],
  rarity: 'CP',
  imageUrl: '1721357284527502.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/03-field-areas.md',
    'rules/20-color-and-switch.md'
  ],
};
