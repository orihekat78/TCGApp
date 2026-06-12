// cards/pr-01/PR104 遠山和葉 (character) — Task A green候補 (engine変更0)
// rules: rules/14-refresh.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/19-special-rules.md, rules/21-declared-ability-cost.md, rules/26-qa-deck-refresh.md
// 公式テキスト:
//   【事件編】【登場時】自分のデッキのカードを上から2枚見る。その中から〚特徴［高校生］〛のキャラを1枚まで公開して手札に加え、残りを好きな順番でデッキの下に移す。\n【解決編】【宣言】【ターン1】このキャラ以外の〚特徴［高校生］〛のキャラを1枚まで選び、ターン終了時までAP＋1000する。
// 句マッピング:
//   - 【事件編】(ability1 condition icon) => condition {kind:'caseStatus',status:'事件編'} on a triggered ability (6-stage gate evaluates ability.condition) [caseStatus condition honored — capability-map.txt §Case/FILE status + hooks 6-stage gate (line 277 'ability.condition'); declared/triggered condition gating confirmed in src/cards/ct-p07/B07021.ts a1 (condition on triggered) and src/cards/ct-p08/B08030.ts a2 (caseStatus '解決編' on declared)]
//   - 【登場時】(ability1 trigger) => trigger {hook:'enter',selfOnly:true} [enter hook (【登場時】) selfOnly — capability-map.txt §CARD-TRIGGERABLE HOOKS 'enter'; exemplar src/cards/ct-p07/B07021.ts a2 (enter selfOnly 登場時)]
//   - 自分のデッキのカードを上から2枚見る => atom deckRevealUntil {player:'self',maxN:2,bind:'$revealed',bindMatch:'$matched'} [deckRevealUntil with maxN reveals min(deck,maxN) — capability-map.txt §Deck ops; exact shape copied from src/cards/ct-p01/B01017.ts a1 (maxN:2 deck-look)]
//   - その中から〚特徴［高校生］〛のキャラを1枚まで公開して手札に加え => deckRevealUntil filter {trait:'高校生',kind:'character'} → conditional bound($matched) → atom handAddFromDeck {cardId:'$matched.cardId'} [deckRevealUntil predicate honors trait+kind (capability-map.txt line 67: cardId/color/trait/ap/lp/level/kind honored); handAddFromDeck splices matched cardId deck→hand (capability-map.txt §Evidence/hand movement). Exact triple copied from src/cards/ct-p01/B01017.ts a1 (trait:'探偵',kind:'character')]
//   - 残りを好きな順番でデッキの下に移す => atom deckToBottomBound {player:'self',bindKey:'$revealed'} [deckToBottomBound moves bound cardIds deck→bottom — capability-map.txt §Deck ops; src/cards/ct-p01/B01017.ts a1 step3 ($revealed = revealed minus matched)]
//   - 【解決編】(ability2 condition icon) => condition {kind:'caseStatus',status:'解決編'} on declared ability [caseStatus '解決編' gates declared ability — src/cards/ct-p08/B08030.ts a2 (declared + condition caseStatus '解決編'); evaluated by cond/eval.ts §Case status]
//   - 【宣言】(ability2) => type:'declared' (no cost — text has no ':' colon) [declared AbilityType — capability-map.txt §3 AbilityDef TYPES; cost optional. Exemplar declared w/ condition+limit and NO required-cost surfacing for the AP pick: src/cards/ct-p08/B08032.ts a2 (declared limit turn1 charModifyAP, no cost)]
//   - 【ターン1】(ability2) => limit:{kind:'turn',n:1} [turn limit enforced for declared via declaredUseCount — capability-map.txt §declared 'Limit {turn:1|2}'; src/cards/ct-p08/B08032.ts a2 (limit:{kind:'turn',n:1})]
//   - このキャラ以外の〚特徴［高校生］〛のキャラを1枚まで選び => atom charModifyAP {uid:'$pick',target:{kind:'pick',query:{area:'scene',side:'self',filter:{trait:'高校生',kind:'character'},excludeSelf:true},n:{min:0,max:1},chooser:'self'}} [explicit-target Pattern A pick — substituteAtomPick reads args.target.query (src/engine/effect/resolve-picks.ts:400,425); excludeSelf drops cand.uid===ctx.source.uid for scene chars (src/engine/target/candidates.ts:184). 'このキャラ以外'=excludeSelf:true, 'のキャラ'=kind:'character'. n.min:0='1枚まで'(0 OK). Exact bare charModifyAP $pick+explicit target shape: src/cards/ct-p07/B07090.ts a1 step2 (trait filter, delta:1000, scope:'turn', n{0,1}); excludeSelf+filter together in bare $pick atom: src/cards/ct-p02/B02061.ts (charGrantKeyword excludeSelf+color filter). NOTE: used explicit target form (NOT short-form args) because buildShortFormPick (atom-pick-spec.ts:67-83) drops excludeSelf — only filter/filterAny/state/distinctNames pass through.]
//   - ターン終了時までAP＋1000する => charModifyAP args delta:1000, scope:'turn' [charModifyAP writes apMod_turn (cleared at turn end) — capability-map.txt §Char modify; src/cards/ct-p07/B07090.ts a1 step2 (delta:1000 scope:'turn')]

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: {
    hook: 'enter',
    selfOnly: true
  },
  condition: {
    kind: 'caseStatus',
    status: '事件編'
  },
  effect: {
    kind: 'sequence',
    steps: [
      {
        kind: 'atom',
        verb: 'deckRevealUntil',
        args: {
          chooseMatch: 'upTo',
          player: 'self',
          filter: {
            trait: '高校生',
            kind: 'character'
          },
          maxN: 2,
          bind: '$revealed',
          bindMatch: '$matched'
        }
      },
      {
        kind: 'conditional',
        if: {
          kind: 'bound',
          key: '$matched',
          presence: 'matched'
        },
        then: {
          kind: 'atom',
          verb: 'handAddFromDeck',
          args: {
            player: 'self',
            cardId: '$matched.cardId'
          }
        }
      },
      {
        kind: 'atom',
        verb: 'deckToBottomBound',
        args: {
          player: 'self',
          bindKey: '$revealed'
        }
      }
    ]
  },
  description: '【事件編】【登場時】自分のデッキのカードを上から2枚見る。その中から〚特徴［高校生］〛のキャラを1枚まで公開して手札に加え、残りを好きな順番でデッキの下に移す。',
  ruleRefs: [
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/26-qa-deck-refresh.md'
  ]
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'declared',
  scope: 'on-scene',
  condition: {
    kind: 'caseStatus',
    status: '解決編'
  },
  limit: {
    kind: 'turn',
    n: 1
  },
  effect: {
    kind: 'atom',
    verb: 'charModifyAP',
    args: {
      uid: '$pick',
      delta: 1000,
      scope: 'turn',
      target: {
        kind: 'pick',
        query: {
          area: 'scene',
          side: 'self',
          filter: {
            trait: '高校生',
            kind: 'character'
          },
          excludeSelf: true
        },
        n: {
          min: 0,
          max: 1
        },
        chooser: 'self'
      }
    }
  },
  description: '【解決編】【宣言】【ターン1】このキャラ以外の〚特徴［高校生］〛のキャラを1枚まで選び、ターン終了時までAP＋1000する。',
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/19-special-rules.md',
    'rules/21-declared-ability-cost.md'
  ]
};

export const PR104: CardDef = {
  id: 'PR104',
  no: '0485/PR104',
  kind: 'character',
  names: [
    '遠山和葉'
  ],
  colors: [
    '緑'
  ],
  level: 4,
  ap: 3000,
  lp: 1,
  traits: [
    '高校生'
  ],
  rarity: 'PR',
  imageUrl: '1743027497316444.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/19-special-rules.md',
    'rules/21-declared-ability-cost.md',
    'rules/26-qa-deck-refresh.md'
  ],
};
