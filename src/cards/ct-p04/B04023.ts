// cards/ct-p04/B04023 遠山銀司郎 (character) — Task A green候補 (engine変更0)
// rules: rules/05-turn-phases.md, rules/14-refresh.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/19-special-rules.md, rules/21-declared-ability-cost.md, rules/26-qa-deck-refresh.md
// 公式テキスト:
//   【FILE7】【自分ターン中】【登場時】このキャラをリムーブしてもよい。そうした場合、レベル7以下のキャラを1枚まで選び、リムーブする。\n【宣言】【ターン1】【スリープ】：自分のデッキのカードを上から1枚公開する。公開したカードが〚特徴［警察］〛のキャラの場合、手札に加える。公開したカードがそれ以外の場合、デッキの下に移す。
// 句マッピング:
//   - 【FILE7】 => condition fileAtLeast{n:7} (AND with turn) [capability-map.txt cond fileAtLeast (assisted-partner counts); exemplar D09014.ts a1 condition:{kind:'fileAtLeast',n:7}]
//   - 【自分ターン中】 => condition turn{player:'self'} [capability-map.txt cond turn (self=owner); brief '【自分ターン中】 self']
//   - 【登場時】 => trigger hook:'enter', selfOnly:true (scope on-scene) [exemplar B01013.ts/B04024.ts/D09014.ts a1 trigger:{hook:'enter',selfOnly:true}; src/engine atom-handlers sceneEnter emits enter hook]
//   - このキャラをリムーブしてもよい。そうした場合、 => Effect optional{ effect: chain{...} } — step1 self-remove gates step2 via 'そうした場合' semantics [brief: 「〜してもよい。そうした場合、X」 = optional + chain; exemplar PR138.ts/PR144.ts a1 = optional{chain[sceneSetState $self, ..., pick]}; chain break only on pick no-candidate (resolver.ts:79 + resolve-picks.ts:436), explicit-uid self-remove never sets __chainStepNoApply]
//   - このキャラをリムーブ (step1 of chain) => atom sceneRemove{uid:'$self', cause:'effect'} [exemplar B03114.ts a1 step1 identical args sceneRemove{uid:'$self',cause:'effect'} for 「このキャラをリムーブする」; rules/15 §効果解決中に発動キャラが現場を離れても継続 (B03114 comment)]
//   - レベル7以下のキャラを1枚まで選び、リムーブする。 => atom sceneRemove{player:'self', max:1, side:'either', filter:{levelMax:7}} [exemplar B03114.ts a1 step2 IDENTICAL wording & args sceneRemove{player:'self',max:1,side:'either',filter:{levelMax:7}}; TargetFilter.levelMax honored (capability-map F); side:'either' = どちらの現場でも選べる rules/15; max:1 = 0枚OK rules/15]
//   - 【宣言】【スリープ】： => type:'declared', cost:{kind:'sleepSelf'} [exemplar D09014.ts a2 cost:{kind:'sleepSelf'} (bare); capability-map cost sleepSelf (sleeps ctx.source.uid, payable only if active); cost対象=自身 rules/21]
//   - 【ターン1】 => limit:{kind:'turn', n:1} [exemplar B08009.ts a1 limit:{kind:'turn',n:1}; capability-map declared limit turn enforced via declaredUseCount]
//   - 自分のデッキのカードを上から1枚公開する。 => atom deckRevealUntil{player:'self', maxN:1, filter:{trait:'警察',kind:'character'}, bind:'$revealed', bindMatch:'$matched'} [src/engine atom-handlers.ts:1037-1104 deckRevealUntil maxN path reveals min(deck,maxN)=1 card; exemplar B01013.ts/B04024.ts (B04024=上から2枚→警察char→hand). maxN:1 => single top card revealed via __pendingDeckRevealSide]
//   - 公開したカードが〚特徴［警察］〛のキャラの場合、手札に加える。 => conditional if bound{$matched,presence:'matched'} then atom handAddFromDeck{cardId:'$matched.cardId'} [deckRevealUntil filter {trait:'警察',kind:'character'} → match binds $matched (atom-handlers.ts:1100-1103); trait+kind honored in targetFilterToPredicate (atom-handlers.ts:70-84, BUG-118 kind honored); exemplar B01013.ts/B04024.ts conditional+handAddFromDeck '$matched.cardId']
//   - 公開したカードがそれ以外の場合、デッキの下に移す。 => atom deckToBottomBound{player:'self', bindKey:'$revealed'} [no-match → $revealed holds the single non-警察 card (atom-handlers.ts:1084-1098 restIds); deckToBottomBound moves bound cardIds to deck bottom; match-case → $revealed empty → no-op (card already to hand). exemplar B01013.ts/B04024.ts deckToBottomBound bindKey:'$revealed']

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
    kind: 'and',
    cs: [
      {
        kind: 'fileAtLeast',
        n: 7
      },
      {
        kind: 'turn',
        player: 'self'
      }
    ]
  },
  effect: {
    kind: 'optional',
    effect: {
      kind: 'chain',
      steps: [
        {
          kind: 'atom',
          verb: 'sceneRemove',
          args: {
            uid: '$self',
            cause: 'effect'
          }
        },
        {
          kind: 'atom',
          verb: 'sceneRemove',
          args: {
            player: 'self',
            max: 1,
            side: 'either',
            filter: {
              levelMax: 7
            }
          }
        }
      ]
    }
  },
  description: '【FILE7】【自分ターン中】【登場時】このキャラをリムーブしてもよい。そうした場合、レベル7以下のキャラを1枚まで選び、リムーブする。',
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/05-turn-phases.md'
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
    kind: 'sleepSelf'
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
            trait: '警察',
            kind: 'character'
          },
          maxN: 1,
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
  description: '【宣言】【ターン1】【スリープ】：自分のデッキのカードを上から1枚公開する。公開したカードが〚特徴［警察］〛のキャラの場合、手札に加える。公開したカードがそれ以外の場合、デッキの下に移す。',
  ruleRefs: [
    'rules/21-declared-ability-cost.md',
    'rules/14-refresh.md',
    'rules/26-qa-deck-refresh.md',
    'rules/19-special-rules.md'
  ]
};

export const B04023: CardDef = {
  id: 'B04023',
  no: '0424/B04023',
  kind: 'character',
  names: [
    '遠山銀司郎'
  ],
  colors: [
    '緑'
  ],
  level: 5,
  ap: 4000,
  lp: 1,
  traits: [
    '警察',
    '大阪府警'
  ],
  rarity: 'C',
  imageUrl: '1735287737409774.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/05-turn-phases.md',
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/19-special-rules.md',
    'rules/21-declared-ability-cost.md',
    'rules/26-qa-deck-refresh.md'
  ],
};
