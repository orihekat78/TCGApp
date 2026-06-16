// cards/ct-p03/B03053 鈴木綾子 (character) — Task A green候補 (engine変更0)
// rules: rules/11-reasoning.md, rules/13-keywords.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/19-special-rules.md
// 公式テキスト:
//   〚ミスリード1〛（相手の推理に対し、スリープさせることでLP－1する）\n【登場時】自分のリムーブエリアにある〚カード名［鈴木綾子］〛以外の〚特徴［鈴木財閥］〛のキャラを1枚まで選び、手札に加える。カードを手札に加えた場合、手札を1枚リムーブする。
// 句マッピング:
//   - 〚ミスリード1〛（相手の推理に対し、スリープさせることでLP－1する） => misreadX({ x:1, abilityId:'a1' }) __shared class → type 'icon-misread' ability (noop effect; engine listener applies sleep+LP-1) [src/cards/_shared/index.ts exports misreadX (registered shared class). src/cards/_shared/misreadX.ts:15-30 returns {type 'icon-misread', scope 'on-scene', effect noop misread-marker x}. src/cards/ct-d04/D04007.ts a1 = misreadX({x:1,abilityId:'a1'}) is an identical live exemplar (also 白/ミスリード1 archetype family). engine src/engine/listeners/misread.ts handles reasoning:before-add. Brief: misreadX is a listed __shared entry.]
//   - 【登場時】 => trigger { hook 'enter', selfOnly:true } [src/cards/ct-p07/B07081.ts a1 and src/cards/ct-p08/B08022.ts a1 both use trigger {hook 'enter', selfOnly:true} for 【登場時】. Hooks list (brief + types/hooks.ts): enter = 【登場時】/【疾風N】. selfOnly:true scopes to this card's own entry only.]
//   - 自分のリムーブエリアにある…キャラを1枚まで選び、手札に加える => atom handAddFromRemove { player:'self', max:1, filter:{...} } (short-form, defaultArea=remove; max:1 ⇒ n.min:0 = 「1枚まで」 0枚可) [capability-map.txt L31: handAddFromRemove splices remove→hand, short-form defaultArea=remove. Live exemplars: src/cards/ct-d10/D10020.ts a2 = handAddFromRemove {player:'self', max:1, filter:{cardName:'江戸川コナン'}}; src/cards/ct-p07/B07081.ts a1 step1 = handAddFromRemove {player:'self', max:1, filter:{...}}. remove-area candidate path src/engine/target/candidates.ts:160-167 → matchesFiltersByCardId:237 → matchOneFilter. '1枚まで'=n.min:0 (rules/15, brief 量指定子).]
//   - 〚カード名［鈴木綾子］〛以外 => filter.cardNameNot:'鈴木綾子' (cluster16 name-exclusion) [cluster16 解禁 (brief §cluster16 G1). Type: src/engine/types/effect.ts:108 cardNameNot?:string|string[]. Honored in matchOneFilter src/engine/target/candidates.ts:270-273 (split-name via allCardNameComponentsForDef; excludes any candidate whose name-component is in nots). Same predicate also in cond/eval.ts:265 and atom-handlers.ts:107 (3-site sync). This is the canonical remove-area pick path. ⚠ cardNameNot is printed-name exclusion (matches '〚カード名[X]〛以外'), NOT a name-designation UI gate.]
//   - 〚特徴［鈴木財閥］〛のキャラ => filter.trait:'鈴木財閥' + filter.kind 'character' [matchOneFilter src/engine/target/candidates.ts:276-280 (trait: def.traits includes wanted) and kind eval (d?.kind !== filter.kind → reject, BUG-118 comment ~L290). 'キャラ' (not 'カード') ⇒ kind 'character' per brief cluster16 ⚠ note. '鈴木財閥' is a real printed trait (e.g. src/cards/ct-d03/D03009.ts). Combined AND with cardNameNot in same filter object.]
//   - カードを手札に加えた場合、手札を1枚リムーブする => chain[ handAddFromRemove(step1), discard{player:'self',n:1}(step2) ] — 「そうした場合」= chain break gating; step2 runs only if step1 actually added a card [Brief: 「そうした場合」= chain (前段成功時のみ後段). src/engine/effect/resolver.ts:79 chain reads __chainStepNoApply → if set, break (skip later steps). src/engine/effect/resolve-picks.ts:544 (0 candidates) and :588 (human 0-pick decline) set __chainStepNoApply. apply-pick.ts:134-179: a plain (no skipResolvesAtom) 0-pick decline drops continuation ⇒ discard NOT run. So step2 discard fires only when a card was added. discard n:1 = mandatory exactly-1 (D04007 a1 step uses verb 'discard' args:{player:'self',n:1} for '手札を1枚リムーブ'). Structural twin: B07081 a1 (enter chain: handAddFromRemove → conditional discard) and B08022 a1 (enter chain step-gating).]

import type { AbilityDef, CardDef } from '@/engine/types';
import { misreadX } from '@/cards/_shared';

const a1 = misreadX({
  x: 1,
  abilityId: 'a1'
});

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-scene',
  trigger: {
    hook: 'enter',
    selfOnly: true
  },
  effect: {
    kind: 'chain',
    steps: [
      {
        kind: 'atom',
        verb: 'handAddFromRemove',
        args: {
          player: 'self',
          max: 1,
          filter: {
            cardNameNot: '鈴木綾子',
            trait: '鈴木財閥',
            kind: 'character'
          }
        }
      },
      {
        kind: 'atom',
        verb: 'discard',
        args: {
          player: 'self',
          n: 1
        }
      }
    ]
  },
  description: '【登場時】自分のリムーブエリアにある〚カード名［鈴木綾子］〛以外の〚特徴［鈴木財閥］〛のキャラを1枚まで選び、手札に加える。カードを手札に加えた場合、手札を1枚リムーブする。',
  ruleRefs: [
    'rules/11-reasoning.md',
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/19-special-rules.md'
  ]
};

export const B03053: CardDef = {
  id: 'B03053',
  no: '0308/B03053',
  kind: 'character',
  names: [
    '鈴木綾子'
  ],
  colors: [
    '白'
  ],
  level: 3,
  ap: 2000,
  lp: 1,
  traits: [
    '大学院生',
    '鈴木財閥'
  ],
  rarity: 'C',
  imageUrl: '1729133385816850.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/11-reasoning.md',
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/19-special-rules.md'
  ],
};
