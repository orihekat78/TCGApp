// cards/ct-p06/B06004 工藤新一 (character) — Task A green候補 (engine変更0)
// rules: rules/15-abilities-effects.md, rules/17-icons.md, rules/19-special-rules.md, rules/21-declared-ability-cost.md, rules/23-qa-disguise-cutin.md, rules/26-qa-deck-refresh.md
// 公式テキスト:
//   【絆毛利蘭】【相手ターン中】自分の現場にいる〚カード名［毛利蘭］〛をAP＋1000する。\n【宣言】【スリープ】〚手札からカード名［毛利蘭］を1枚公開する〛：相手の現場にいるレベル7以下のキャラを1枚まで選び、デッキの下に移す。
// 句マッピング:
//   - 【絆毛利蘭】【相手ターン中】自分の現場にいる〚カード名［毛利蘭］〛をAP＋1000する。 => a1: type 'continuous' scope 'on-scene', condition and[bond{cardName:'毛利蘭'}, turn{player:'opp'}], continuousModifier{apDeltaAura:1000, auraFilter:{cardName:'毛利蘭', kind 'character'}} [BYTE-TWIN exemplar src/cards/ct-p09/B09080.ts a2 (shipped): condition and[bond '佐藤美和子', turn 'opp'] + continuousModifier{apDeltaAura:1000, auraFilter:{cardName:'佐藤美和子', kind 'character'}}, identical text shape '【絆X】【相手ターン中】自分の現場にいる〚カード名[X]〛をAP＋1000する'. Aura reader src/engine/read/char.ts auraDelta L72-107: scans own-side(ownerSide) scene bearers, honors ability.condition via evalCond(bearerCtx) L99 (bearerCtx.source.player=ownerSide), matchOneFilter on auraFilter L101-102. turn cond src/engine/cond/eval.ts:35 = state.turn.player===resolvePlayer('opp',ctx) (opp-of-owner). bond cond eval.ts:92 scans owner scene name-components incl split-names. auraFilter cardName honored by matchOneFilter src/engine/target/candidates.ts:271. No 'このキャラ以外' in text → auraExcludeSelf omitted (bearer=工藤新一 never matches 毛利蘭 anyway). 毛利蘭 is a registered card name (D01006/D08023/D10007).]
//   - 【宣言】 (declared ability) => a2: type 'declared' scope 'on-scene' (no limit field — text has no 【ターンN】) [src/cards/ct-p03/B03035.ts a1 (shipped) = declared/on-scene with NO limit field. card-def AbilityType 'declared' (capability-map: player-declared, cost paid then effect).]
//   - 【スリープ】 (cost icon) => a2 cost.items[0] = {kind 'sleepSelf'} [src/cards/ct-p03/B03035.ts a1 cost.items[0]={kind 'sleepSelf'} models 【スリープ】 cost. canPay sleepSelf requires active state (src/engine/cost/evaluate.ts), rules/21.]
//   - 〚手札からカード名［毛利蘭］を1枚公開する〛 (bracketed cost) => a2 cost.items[1] = {kind 'revealFromHand', target:pick hand side:self filter{cardName:'毛利蘭', kind 'character'} n{1,1} chooser:self, n:1} [Cost kind 'revealFromHand' = {kind 'revealFromHand'; target:TargetingRef; n:number} src/engine/types/effect.ts:252 (engine additive 2026-06-28). canPay src/engine/cost/evaluate.ts:66 = candidates(cost.target)>=n (presence-check, gates declaration if no 毛利蘭 in hand). pay src/engine/cost/pay.ts:101 = pickCandidates(cost.target,n) then NO-OP (no consumption, card stays in hand — only revealed) — byte-identical to removeFromHand pay (pay.ts:90) minus discardToRemove. UI costToText src/ui/hooks/useActionsPanelFlow/cost.ts:31 ('手札から N 枚を公開') + exhaustive never-check L50 typechecks. Cost target pick shape copied from removeFromHand exemplar D02013.ts a1 / B03036.ts a2 (filter on hand cost honored: B03036 used filter{trait:'探偵',kind 'character'}). kind 'character' added per BUG-123 (hand char pick). NOTE: zero shipped card currently uses revealFromHand (intended exemplar B08093 not yet shipped), but the primitive is fully wired engine+UI; pick mechanism identical to widely-shipped removeFromHand.]
//   - 【スリープ】 + 〚手札公開〛 複合コスト (must do all, rules/21) => a2 cost = {kind 'pay', items:[sleepSelf, revealFromHand]} [src/cards/ct-p03/B03035.ts a1 cost={kind 'pay', items:[{sleepSelf},{removeSetCard}]} and B03036.ts a2 cost={kind 'pay', items:[{sleepSelf},{removeFromHand...}]} = same pay-combo of sleepSelf + bracketed cost. canPay pay src/engine/cost/evaluate.ts:109 = items.every(canPay); pay src/engine/cost/pay.ts:214 = every item paid (rules/21 コストを全て行う).]
//   - 相手の現場にいるレベル7以下のキャラを1枚まで選び、デッキの下に移す。 => a2 effect = atom sceneToDeck {player:'self', side:'opp', max:1, filter:{levelMax:7}, pos:'bottom'} [EXACT PA short-form exemplar src/cards/ct-p08/B08058.ts a2 (shipped): {verb 'sceneToDeck', args:{player:'self', side:'either', max:1, filter:{levelMax:8}, pos:'bottom'}} for 'レベル8以下…を1枚まで選び、デッキの下に移す'. Handler src/engine/effect/atom-handlers/scene.ts atomSceneToDeck L324: PA short-form path (uid undefined + player string + hasNorMax) → paShortFormAwait; buildShortFormPick src/engine/effect/atom-pick-spec.ts:79 honors explicit a.side='opp', a.filter{levelMax:7}, max→n{min:0,max:1} ('1枚まで'=0-OK rules/15). pos:'bottom' = mutate.scene.toDeck bottom (リムーブでない → 【現場リムーブ時】不発火 rules/23/26). MUST use PA short-form (uid undefined), NOT uid:'$pick'+target — handler L329 makes uid==='$pick' a skip no-op (BUG-130). levelMax honored by matchOneFilter.]

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'continuous',
  scope: 'on-scene',
  condition: {
    kind: 'and',
    cs: [
      {
        kind: 'bond',
        cardName: '毛利蘭'
      },
      {
        kind: 'turn',
        player: 'opp'
      }
    ]
  },
  continuousModifier: {
    apDeltaAura: 1000,
    auraFilter: {
      cardName: '毛利蘭',
      kind: 'character'
    }
  },
  description: '【絆毛利蘭】【相手ターン中】自分の現場にいる〚カード名［毛利蘭］〛をAP＋1000する。',
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/19-special-rules.md'
  ]
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'declared',
  scope: 'on-scene',
  cost: {
    kind: 'pay',
    items: [
      {
        kind: 'sleepSelf'
      },
      {
        kind: 'revealFromHand',
        target: {
          kind: 'pick',
          query: {
            area: 'hand',
            side: 'self',
            filter: {
              cardName: '毛利蘭',
              kind: 'character'
            }
          },
          n: {
            min: 1,
            max: 1
          },
          chooser: 'self'
        },
        n: 1
      }
    ]
  },
  effect: {
    kind: 'atom',
    verb: 'sceneToDeck',
    args: {
      player: 'self',
      side: 'opp',
      max: 1,
      filter: {
        levelMax: 7
      },
      pos: 'bottom'
    }
  },
  description: '【宣言】【スリープ】〚手札からカード名［毛利蘭］を1枚公開する〛：相手の現場にいるレベル7以下のキャラを1枚まで選び、デッキの下に移す。',
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md',
    'rules/23-qa-disguise-cutin.md',
    'rules/26-qa-deck-refresh.md'
  ]
};

export const B06004: CardDef = {
  id: 'B06004',
  no: '0629/B06004',
  kind: 'character',
  names: [
    '工藤新一'
  ],
  colors: [
    '青'
  ],
  level: 7,
  ap: 6000,
  lp: 1,
  traits: [
    '探偵',
    '高校生'
  ],
  rarity: 'SR',
  imageUrl: '1754284680536189.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/19-special-rules.md',
    'rules/21-declared-ability-cost.md',
    'rules/23-qa-disguise-cutin.md',
    'rules/26-qa-deck-refresh.md'
  ],
};
