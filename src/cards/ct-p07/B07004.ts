// cards/ct-p07/B07004 吉田歩美 (character) — Task A green候補 (engine変更0)
// rules: rules/21-declared-ability-cost.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/20-color-and-switch.md, rules/26-qa-deck-refresh.md
// 公式テキスト:
//   【パートナー青】【宣言】【スリープ】：自分のデッキのカードを上から4枚見る。その中からレベル8以下の〚カード名［小嶋元太］〛か〚［円谷光彦］〛のキャラを1枚まで登場させ、残りを好きな順番でデッキの下に移す。キャラを登場させた場合、手札を1枚リムーブする。
// 句マッピング:
//   - 【パートナー青】 => ability.condition = {kind 'partnerColor', color:'青'} [B07067.ts a1 uses condition:{kind 'partnerColor',color:'赤'}; cond/eval.ts evaluates partnerColor (owner partner colors intersect). capability-map §B: ability.condition is the 6-stage condition gate honored for declared abilities. rules/17 §条件未充足=能力を持たない扱い.]
//   - 【宣言】 => AbilityDef type 'declared', scope 'on-scene' [B07089.ts a1 + B07067.ts a2 = {type 'declared', scope 'on-scene'} on a scene character. card-def.ts AbilityType includes 'declared'; declared-ability flow pays cost then runs effect (rules/21).]
//   - 【スリープ】 (コスト = このキャラ自身をスリープ) => cost: {kind 'sleepSelf'} [B07089.ts a1 + B07067 = bare cost:{kind 'sleepSelf'}. cost/evaluate.ts+pay.ts sleepSelf sleeps ctx.source.uid, payable only when active. rules/21: 対象が書かれていないコストは能力を使うキャラ自身.]
//   - 自分のデッキのカードを上から4枚見る => atom deckRevealUntil {player:'self', maxN:4, bind:'$revealed', bindMatch:'$matched'} [B03073.ts a1 uses deckRevealUntil{maxN:4,...}. atom-handlers.ts:1395-1410 maxN branch reveals min(deck,maxN)=4 into 'revealed', binds first filter match → 'matched'. ATOM_VERB_MAP (validate.ts:36) has deckRevealUntil.]
//   - その中からレベル8以下の〚カード名［小嶋元太］〛か〚［円谷光彦］〛のキャラ (候補filter) => filter:{cardName:['小嶋元太','円谷光彦'], levelMax:8, kind 'character'} [atom-handlers.ts targetFilterToPredicate (live): cardName honored at lines 101-105 via allCardNameComponentsForDef with wants.some(...) = OR over the array (cluster2/BUG-122 fix — supersedes STALE cap-map which said cardName dropped); levelMax at line 90; kind at line 92. B07089.ts a1 proves array-OR (trait:['警察','探偵']) + kind 'character' in this exact deckRevealUntil predicate path.]
//   - を1枚まで登場させ (0枚可・player選択) => chooseMatch:'upTo' on deckRevealUntil + conditional{if:bound $matched matched} → sceneEnter {cardId:'$matched.cardId', viaEffect:true, target:{query:{area:'deck',side:'self'}}} [B03073.ts a1 = exact pattern (上から4枚見る…1枚まで登場…残りデッキ下). atom-handlers.ts:1421+ chooseMatch:'upTo' surfaces nMin:0/nMax:1 pick for human owner (rules/15 「まで」=0枚可, B08020 qAndA 加えない選択可); sceneEnter with target area:'deck' splices the matched card out of deck (BUG-102 dup-prevention). viaEffect:true = 効果による登場 (色制限なし rules/20, 【登場時】発火 qAndA). 現場満杯時 switch は handler 管轄.]
//   - 残りを好きな順番でデッキの下に移す => atom deckToBottomBound {player:'self', bindKey:'$revealed'} [B03073.ts a1 + B07089.ts a1 trailing step. atom-handlers.ts deckToBottomBound moves bound $revealed cardIds from deck to bottom (mutate.deck.toBottom). chooseMatch re-entry path rebuilds $revealed = window minus chosen (atom-handlers.ts:1361-1372).]
//   - キャラを登場させた場合、手札を1枚リムーブする => conditional{if:bound $matched matched} → atom discard {player:'self', n:1} [discard handler atom-handlers.ts:321-359: n:1 short-form builds a hand pick, then mutate.hand.discardToRemove (手札→リムーブ). D01013.ts/D08026.ts use discard{n:1} (forced 1, 「リムーブする」=必須 not 「してもよい」). Gated on $matched matched because $matched non-empty ⟺ a char was chosen at the reveal step ⟺ it is entered → '登場させた場合' is exactly this. cond/eval bound presence:'matched' = non-empty array.]

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'declared',
  scope: 'on-scene',
  condition: {
    kind: 'partnerColor',
    color: '青'
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
          maxN: 4,
          chooseMatch: 'upTo',
          filter: {
            cardName: [
              '小嶋元太',
              '円谷光彦'
            ],
            levelMax: 8,
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
          verb: 'sceneEnter',
          args: {
            player: 'self',
            cardId: '$matched.cardId',
            viaEffect: true,
            target: {
              query: {
                area: 'deck',
                side: 'self'
              }
            }
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
        kind: 'conditional',
        if: {
          kind: 'bound',
          key: '$matched',
          presence: 'matched'
        },
        then: {
          kind: 'atom',
          verb: 'discard',
          args: {
            player: 'self',
            n: 1
          }
        }
      }
    ]
  },
  description: '【パートナー青】【宣言】【スリープ】：自分のデッキのカードを上から4枚見る。その中からレベル8以下の〚カード名［小嶋元太］〛か〚［円谷光彦］〛のキャラを1枚まで登場させ、残りを好きな順番でデッキの下に移す。キャラを登場させた場合、手札を1枚リムーブする。',
  ruleRefs: [
    'rules/21-declared-ability-cost.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/20-color-and-switch.md',
    'rules/26-qa-deck-refresh.md'
  ]
};

export const B07004: CardDef = {
  id: 'B07004',
  no: '0736/B07004',
  kind: 'character',
  names: [
    '吉田歩美'
  ],
  colors: [
    '青'
  ],
  level: 7,
  ap: 5000,
  lp: 1,
  traits: [
    '少年探偵団'
  ],
  rarity: 'R',
  imageUrl: '1762413976056396.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/21-declared-ability-cost.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/20-color-and-switch.md',
    'rules/26-qa-deck-refresh.md'
  ],
};
