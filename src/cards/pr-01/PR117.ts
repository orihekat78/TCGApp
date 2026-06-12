// cards/pr-01/PR117 江戸川コナン (character) — Task A green候補 (engine変更0)
// rules: rules/14-refresh.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/19-special-rules.md, rules/26-qa-deck-refresh.md
// 公式テキスト:
//   【登場時】自分のデッキのカードを上からレベル7以上の〚特徴［探偵］〛のキャラが出るまで1枚ずつ公開し、それを手札に加える。残りの公開したカードをデッキの下に移し、デッキをシャッフルする。\n【自分ターン中】【ターン1】このキャラ以外の〚特徴［探偵］〛のキャラが自分の現場に登場したとき、手札を1枚リムーブしてもよい。そうした場合、レベル7以下のキャラを1枚まで選び、リムーブする。
// 句マッピング:
//   - 【登場時】 (ability 1 trigger) => type:'triggered', scope:'on-scene', trigger:{hook:'enter',selfOnly:true} [enter hook is card-triggerable (capability-map §B; emit at src/engine/effect/atom-handlers.ts:653 payload {uid,viaEffect,enterOrder,enterOrderThisTurn}, selfOnly matches source.uid). Exact exemplar: src/cards/ct-d11/D11019.ts a1 / src/cards/ct-p01/B01013.ts a1 (【登場時】 deck-reveal).]
//   - 自分のデッキのカードを上からレベル7以上の〚特徴［探偵］〛のキャラが出るまで1枚ずつ公開し (reveal 1-by-1 until match, no upper bound) => atom deckRevealUntil {player:'self', filter:{trait:'探偵',levelMin:7,kind:'character'}, bind:'$revealed', bindMatch:'$matched'} (NO maxN = 1-by-1 until match/end) [capability-map: deckRevealUntil — 'if maxN set reveals min(deck,maxN); else reveals 1-by-1 until match/end'; honors trait/levelMin/kind in predicate path (BUG-117/118 fixed). Exact no-maxN exemplar: src/cards/ct-d11/D11019.ts a1 (deckRevealUntil filter {color,levelMax,kind} no maxN, bind/bindMatch).]
//   - それを手札に加える (guaranteed add matched card to hand) => conditional{if bound $matched matched, then atom handAddFromDeck {player:'self', cardId:'$matched.cardId'}} [handAddFromDeck splices bound matched cardId deck→hand (capability-map; src/cards/ct-p01/B01013.ts a1). Wrapped in conditional on $matched matched so 'no such card' edge (出なければ) safely no-ops (D11019 a1 same conditional gate).]
//   - 残りの公開したカードをデッキの下に移し => atom deckToBottomBound {player:'self', bindKey:'$revealed'} [deckToBottomBound moves bound revealed cardIds to deck bottom (capability-map; exemplar src/cards/ct-d11/D11019.ts a1, src/cards/ct-p01/B01013.ts a1).]
//   - デッキをシャッフルする => atom deckShuffle {player:'self'} [deckShuffle = mutate.deck.shuffle(ctx.rng) (capability-map). Exact exemplar: src/cards/ct-d11/D11019.ts a1 (deckShuffle as final sequence step after deckToBottomBound).]
//   - 【自分ターン中】 (ability 2 condition) => condition:{kind:'turn',player:'self'} [turn condition (capability-map §E cond/eval.ts). Standard 【自分ターン中】 gate.]
//   - 【ターン1】 (ability 2 limit) => limit:{kind:'turn',n:1} [triggered limit:{kind:'turn',n} enforced per uid+abilityId via declaredUseCount (capability-map hooks §How a triggered ability fires). Exemplar: src/cards/ct-p09/B09013.ts a2, src/cards/ct-p08/B08034.ts a2.]
//   - このキャラ以外の〚特徴［探偵］〛のキャラが自分の現場に登場したとき (other 探偵 char enters own scene) => trigger:{hook:'enter', matcherCondition:{kind:'triggerCharMatches', side:'self', payloadKey:'uid', excludeSource:true, filter:{trait:'探偵'}}} (NOT selfOnly) [enter payload lacks 'player' (atom-handlers.ts:653 / next-hint.ts:114 / hand-use-card.ts:159 all emit {uid,viaEffect,enterOrder,enterOrderThisTurn} only) → MUST use payloadKey:'uid' so triggerCharMatches derives side by scene-scan (src/engine/cond/eval.ts:272-280). side:'self' gates own-side (eval.ts:287). excludeSource:true drops self-entry='このキャラ以外' (eval.ts:288, type effect.ts:68). filter:{trait:'探偵'} via matchOneFilter on the entering scene char (eval.ts:291-294; char in scene before emit). matcherCondition wired on enter via generic handleHook (src/engine/listeners/triggered.ts:190-202, evalCond with triggerPayload). payloadKey grounded by src/cards/ct-p09/B09041.ts a1 (action:guarded, payloadKey:'guardUid'). NO card exemplar combines enter+payloadKey:'uid'+excludeSource → engine-grounded only.]
//   - 手札を1枚リムーブしてもよい。そうした場合、… (optional discard-1 cost-prefix) => {kind:'optional', effect:{kind:'chain', steps:[discard, ...]}}; first chain step atom discard {player:'self', n:1} [optional = 「してもよい」 (resolver runs only if optionalRun; AI skips — capability-map/brief). chain = 「そうした場合」 no-op-stops-chain (capability-map §C). discard hand→remove (capability-map atom). Exemplar pattern: src/cards/ct-p09/B09013.ts a2 (optional→chain[…]) + src/cards/ct-p08/B08034.ts a2 (chain[charRemoveSetCard,draw] = cost-prefix→そうした場合). Per brief: cost-prefix '手札1枚リムーブしてもよい→' = optional+chain[discard, X].]
//   - レベル7以下のキャラを1枚まで選び、リムーブする => atom sceneRemove {player:'self', max:1, side:'either', cause:'effect', filter:{levelMax:7}} [sceneRemove short-form PA pick; levelMax honored by matchOneFilter (capability-map §F). side:'either' since unqualified 'キャラ' = both scenes (rules/15). max:1 = '1枚まで' (0-pick legal, nMin0/nMax1). Exact exemplar: src/cards/ct-p09/B09013.ts a2 (sceneRemove {player:'self',max:1,side:'either',state:['sleep'],filter:{levelMax:7}}) and src/cards/ct-p08/B08034.ts a1 (sceneRemove {player:'self',max:1,side:'either',cause:'effect',filter:{apMax:8000}}).]
//   - 本体ステータス 江戸川コナン / 青 / Lv8 / AP7000 / LP2 / 特徴[探偵|毛利探偵事務所|少年探偵団] / 印字キーワードなし => CardDef kind:'character', colors:['青'], level:8, ap:7000, lp:2, traits:['探偵','毛利探偵事務所','少年探偵団'], keywords:[] [.tmp/taskA/recs/PR117.json record. No printed 迅速/突撃/疾風/ブレット icon → keywords:[].]

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
    kind: 'sequence',
    steps: [
      {
        kind: 'atom',
        verb: 'deckRevealUntil',
        args: {
          player: 'self',
          filter: {
            trait: '探偵',
            levelMin: 7,
            kind: 'character'
          },
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
      },
      {
        kind: 'atom',
        verb: 'deckShuffle',
        args: {
          player: 'self'
        }
      }
    ]
  },
  description: '【登場時】自分のデッキのカードを上からレベル7以上の〚特徴［探偵］〛のキャラが出るまで1枚ずつ公開し、それを手札に加える。残りの公開したカードをデッキの下に移し、デッキをシャッフルする。',
  ruleRefs: [
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/26-qa-deck-refresh.md'
  ]
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-scene',
  condition: {
    kind: 'turn',
    player: 'self'
  },
  limit: {
    kind: 'turn',
    n: 1
  },
  trigger: {
    hook: 'enter',
    matcherCondition: {
      kind: 'triggerCharMatches',
      side: 'self',
      payloadKey: 'uid',
      excludeSource: true,
      filter: {
        trait: '探偵'
      }
    }
  },
  effect: {
    kind: 'optional',
    effect: {
      kind: 'chain',
      steps: [
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
          verb: 'sceneRemove',
          args: {
            player: 'self',
            max: 1,
            side: 'either',
            cause: 'effect',
            filter: {
              levelMax: 7
            }
          }
        }
      ]
    }
  },
  description: '【自分ターン中】【ターン1】このキャラ以外の〚特徴［探偵］〛のキャラが自分の現場に登場したとき、手札を1枚リムーブしてもよい。そうした場合、レベル7以下のキャラを1枚まで選び、リムーブする。',
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/19-special-rules.md'
  ]
};

export const PR117: CardDef = {
  id: 'PR117',
  no: '0618/PR117',
  kind: 'character',
  names: [
    '江戸川コナン'
  ],
  colors: [
    '青'
  ],
  level: 8,
  ap: 7000,
  lp: 2,
  traits: [
    '探偵',
    '毛利探偵事務所',
    '少年探偵団'
  ],
  rarity: 'PR',
  imageUrl: '196cf39ad5a88.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/19-special-rules.md',
    'rules/26-qa-deck-refresh.md'
  ],
};
