// cards/ct-p06/B06013P 厄介な難事件 (case) — Task A green候補 (engine変更0)
// rules: rules/01-victory-conditions.md, rules/14-refresh.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/19-special-rules.md, rules/21-declared-ability-cost.md, rules/26-qa-deck-refresh.md
// 公式テキスト:
//   この事件が解決編に移行したとき、自分は手札を1枚リムーブする。\n【解決編】【宣言】【ターン1】〚裏向きの証拠を2つ表向きにする〛：自分のデッキのカードを上から3枚見る。その中から〚カード名［工藤新一］〛か〚［毛利蘭］〛を1枚まで公開して手札に加え、残りを好きな順番でデッキの下に移す。この能力は自分の現場に〚カード名［工藤新一］〛か〚［毛利蘭］〛がいる場合に宣言できる。
// 句マッピング:
//   - この事件が解決編に移行したとき、自分は手札を1枚リムーブする。 => a1: triggered hook 'case:to-resolved' selfOnly:true → atom discard {player:'self', n:1} [src/cards/ct-p08/B08094.ts a1 は同一テキスト『この事件が解決編になったとき、自分は手札を1枚リムーブする。』を selfOnly:true + discard{player:'self',n:1} で実装 (D08026/D11021 a1 も同型)。src/engine/mutate/case.ts:37 が case:to-resolved を source{uid:`case:${p}`} で emit、selfOnly が source.uid===card.uid で自分の事件のみ gate。一方通行のためゲーム中1回 (rules/01)。]
//   - 【解決編】… この能力は自分の現場に〚カード名［工藤新一］〛か〚［毛利蘭］〛がいる場合に宣言できる。 => a2.condition = and(caseStatus '解決編', sceneHas{side:'self', filter:{cardName:['工藤新一','毛利蘭']}}) [src/cards/ct-p08/B08094.ts a2.condition が and(caseStatus:'解決編', sceneHas{side:'self', filter:{cardName:['シェリー','灰原哀']}}) — 全く同じ宣言ゲート形 (cardName 配列で OR)。src/engine/cond/eval.ts:91 sceneHas は candidates()→matchOneFilter 経由で cardName を honor (nMin 既定=1='がいる')。分割名カードも allCardNameComponents で一致 (rules/19)。]
//   - 【宣言】【ターン1】 => a2 type 'declared' + limit:{kind 'turn', n:1} [capability-map.txt §declared (line 461) + B08094.ts a2 line limit:{kind 'turn',n:1}。事件カードは case area 所在のため scope 'always' (on-scene だと declared 列挙で弾かれる、user_request 20260522_01 #5 fix、D08026/D11021/B08094 共通注記)。0枚取得でも発動済み扱いでカウント (rules/24 / B08020 TSV qAndA)。]
//   - 〚裏向きの証拠を2つ表向きにする〛 (コスト) => a2.cost = {kind 'flipFaceUpEvidence', n:{min:2, max:2}} [src/cards/ct-p07/B07062.ts:36 と src/cards/ct-p08/B08094.ts:73 が flipFaceUpEvidence n:{min:2,max:2} (固定2枚)。capability-map cost節 (line 388): facedown count ≥ n.min で payable、pay は picked count ∉[min,max] で throw。「:」左=自分の証拠のみ。]
//   - 自分のデッキのカードを上から3枚見る。その中から〚カード名［工藤新一］〛か〚［毛利蘭］〛を1枚まで公開して手札に加え、残りを好きな順番でデッキの下に移す。 => a2.effect = sequence[ deckRevealUntil{maxN:3, filter:{cardName:['工藤新一','毛利蘭']}, chooseMatch:'upTo', bind:'$revealed', bindMatch:'$matched'} → conditional(bound $matched matched) handAddFromDeck($matched.cardId) → deckToBottomBound($revealed) ] [src/cards/ct-p08/B08094.ts a2.effect は完全同型 (deckRevealUntil maxN:3 chooseMatch:'upTo' → conditional bound matched → handAddFromDeck $matched.cardId → deckToBottomBound $revealed)。唯一の差は filter が B08094=keyword:'現場リムーブ時'、本カード=cardName:['工藤新一','毛利蘭']。src/engine/effect/atom-handlers.ts:65 targetFilterToPredicate (deckRevealUntil 経路) は line 104-108 で filter.cardName を allCardNameComponentsForDef で honor (BUG-122/cluster2、capability-map line 67 の『cardName not honored』は STALE — memory note 13982 + line 580 注記で訂正済)。「1枚まで」=chooseMatch:'upTo' (0枚可、BUG-132 GAP-1、atom-handlers.ts:1423 が human owner に pick surface)。handAddFromDeck $matched.cardId bind は src/cards/ct-d01/D01013.ts:44 で実証。デッキ3枚未満=残り全部見て加えた時点で deck0 なら refresh (rules/26)。]

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'always',
  trigger: {
    hook: 'case:to-resolved',
    selfOnly: true
  },
  effect: {
    kind: 'atom',
    verb: 'discard',
    args: {
      player: 'self',
      n: 1
    }
  },
  description: 'この事件が解決編に移行したとき、自分は手札を1枚リムーブする。',
  ruleRefs: [
    'rules/01-victory-conditions.md',
    'rules/15-abilities-effects.md'
  ]
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'declared',
  scope: 'always',
  condition: {
    kind: 'and',
    cs: [
      {
        kind: 'caseStatus',
        status: '解決編'
      },
      {
        kind: 'sceneHas',
        query: {
          area: 'scene',
          side: 'self',
          filter: {
            cardName: [
              '工藤新一',
              '毛利蘭'
            ]
          }
        }
      }
    ]
  },
  limit: {
    kind: 'turn',
    n: 1
  },
  cost: {
    kind: 'flipFaceUpEvidence',
    n: {
      min: 2,
      max: 2
    }
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
            cardName: [
              '工藤新一',
              '毛利蘭'
            ]
          },
          maxN: 3,
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
  description: '【解決編】【宣言】【ターン1】〚裏向きの証拠を2つ表向きにする〛：自分のデッキのカードを上から3枚見る。その中から〚カード名［工藤新一］〛か〚［毛利蘭］〛を1枚まで公開して手札に加え、残りを好きな順番でデッキの下に移す。この能力は自分の現場に〚カード名［工藤新一］〛か〚［毛利蘭］〛がいる場合に宣言できる。',
  ruleRefs: [
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/19-special-rules.md',
    'rules/21-declared-ability-cost.md',
    'rules/26-qa-deck-refresh.md'
  ]
};

export const B06013P: CardDef = {
  id: 'B06013P',
  no: '0638/B06013P',
  kind: 'case',
  names: [
    '厄介な難事件'
  ],
  colors: [
    '青'
  ],
  caseTraits: [],
  traits: [],
  rarity: 'CP',
  imageUrl: '1755741761056424.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/01-victory-conditions.md',
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/19-special-rules.md',
    'rules/21-declared-ability-cost.md',
    'rules/26-qa-deck-refresh.md'
  ],
};
