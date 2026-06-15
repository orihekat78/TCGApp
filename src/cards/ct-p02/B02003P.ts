// cards/ct-p02/B02003P 工藤新一 (character) — Task A green候補 (engine変更0)
// rules: rules/15-abilities-effects.md, rules/17-icons.md, rules/19-special-rules.md, rules/21-declared-ability-cost.md, rules/23-qa-disguise-cutin.md
// 公式テキスト:
//   【パートナー青】【登場時】レベル7以下のキャラを1枚まで選び、デッキの下に移す。\n【宣言】【ターン1】〚カード名［毛利蘭］〛のキャラを1枚まで選び、ターン終了時までLP＋1する。
// 句マッピング:
//   - 【パートナー青】 => ability.condition { kind 'partnerColor', color:'青' } [src/cards/ct-d01/D01004.ts line 16: condition: { kind  'partnerColor', color: '青' } — exact same card 工藤新一 同 stats 同 prefix. condition kind 'partnerColor' enumerated in capability-map Conditions list.]
//   - 【登場時】 => trigger { hook 'enter', selfOnly:true } [src/cards/ct-d01/D01004.ts line 18: trigger  { hook  'enter', selfOnly: true }. enter hook = 【登場時】per capability-map Hooks. selfOnly boolean is JSON-safe (no function matcher).]
//   - レベル7以下のキャラを1枚まで選び、デッキの下に移す => atom sceneToDeck { player:'self', side:'either', max:1, filter:{levelMax:7}, pos:'bottom' } [src/cards/ct-p08/B08058.ts a2 step3 uses sceneToDeck {player:'self', side:'either', max:1, filter:{levelMax:8}, ..., pos:'bottom'} (here state omitted since B02003 has no 状態 restriction). Engine handler src/engine/effect/atom-handlers.ts case 'sceneToDeck' (line 944): short-form when uid absent + player string + n/max -> paShortFormAwait, chooser=controller, side=a.player default but overridable. buildShortFormPick (atom-pick-spec.ts line 78) a.side overrides sideDefault; line 80 passes filter through; line 82 state passed only if array (so omitting state is correct). pos 'bottom' default honored (line 960). max:1 = 0〜1 (rules/15 「〜まで」=nMin0). 移動先=対象キャラ所有者のデッキ下 (handler comment, rules-correct for either-side selection, no 自分の/相手の in text).]
//   - 【宣言】 => ability.type 'declared' [src/cards/ct-d01/D01006.ts a1: type 'declared'. card-def.ts AbilityType union includes 'declared' (line 15). No 「：」 colon in B02003 a2 text -> no cost; cost?: Cost is optional (card-def.ts line 117); many declared abilities have no cost (e.g. D01006, B02010 confirmed via grep).]
//   - 【ターン1】 => ability.limit { kind 'turn', n:1 } [src/cards/ct-d01/D01006.ts a1 line: limit: { kind  'turn', n: 1 }. card-def.ts AbilityLimit = { kind 'turn'; n: 1|2 } (lines 36-40). brief: 【ターンN】= ability limit.]
//   - 〚カード名［毛利蘭］〛のキャラを1枚まで選び、ターン終了時までLP＋1する => atom charModifyLP { delta:1, max:1, side:'either', filter:{cardName:'毛利蘭'}, scope 'turn' } [src/cards/ct-d01/D01006.ts a1: charModifyAP { delta:1000, max:1, side:'either', scope 'turn' } (declared 【ターン1】 同型, here LP instead of AP). src/cards/ct-d11/D11012.ts a1 option1: charModifyLP { delta:1, max:1, side:'self', filter:{...}, scope 'turn' } confirms charModifyLP turn-scope + filter + max shape. cardName filter honored in src/engine/target/candidates.ts lines 260-266 (split-name matching rules/19). capability-map: charModifyLP same shape/semantics as charModifyAP, scope 'turn' valid. max:1 = 0〜1 (rules/15). side:'either' = no side restriction in text (default either, matching D01006/D11012).]

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  condition: {
    kind: 'partnerColor',
    color: '青'
  },
  trigger: {
    hook: 'enter',
    selfOnly: true
  },
  effect: {
    kind: 'atom',
    verb: 'sceneToDeck',
    args: {
      player: 'self',
      side: 'either',
      max: 1,
      filter: {
        levelMax: 7
      },
      pos: 'bottom'
    }
  },
  description: '【パートナー青】【登場時】レベル7以下のキャラを1枚まで選び、デッキの下に移す。',
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/23-qa-disguise-cutin.md'
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
  effect: {
    kind: 'atom',
    verb: 'charModifyLP',
    args: {
      delta: 1,
      max: 1,
      side: 'either',
      filter: {
        cardName: '毛利蘭'
      },
      scope: 'turn'
    }
  },
  description: '【宣言】【ターン1】〚カード名［毛利蘭］〛のキャラを1枚まで選び、ターン終了時までLP＋1する。',
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/21-declared-ability-cost.md',
    'rules/19-special-rules.md'
  ]
};

export const B02003P: CardDef = {
  id: 'B02003P',
  no: '0175/B02003P',
  kind: 'character',
  names: [
    '工藤新一'
  ],
  colors: [
    '青'
  ],
  level: 8,
  ap: 7000,
  lp: 2,
  traits: [
    '探偵',
    '高校生'
  ],
  rarity: 'SRP',
  imageUrl: '1721357158819164.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/19-special-rules.md',
    'rules/21-declared-ability-cost.md',
    'rules/23-qa-disguise-cutin.md'
  ],
};
