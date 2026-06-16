// cards/ct-p03/B03016 円谷光彦 (character) — Task A green候補 (engine変更0)
// rules: rules/14-refresh.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/20-color-and-switch.md, rules/21-declared-ability-cost.md, rules/26-qa-deck-refresh.md
// 公式テキスト:
//   【宣言】【スリープ】：自分のデッキのカードを上から1枚公開する。公開したカードが〚カード名［阿笠博士］〛か〚特徴［少年探偵団］〛のキャラの場合、手札に加える。公開したカードがそれ以外の場合、デッキの下に移す。
// 句マッピング:
//   - 【宣言】 => ability.type='declared', scope='on-scene' [src/cards/ct-p01/B01048.ts a1 と ct-p07/B07020.ts a1 が type 'declared' scope 'on-scene'。brief DSL規約「【宣言】= declared:true + cost」。canDeclaredAbility が cost.canPay でゲートする。]
//   - 【スリープ】：(コロン左にスリープのみ、他コスト無し) => cost:{kind 'sleepSelf'} [src/cards/ct-p01/B01048.ts a1 が cost:{kind 'sleepSelf'} を bare で使用 (B03016 テキストは 【スリープ】の直後に『：』で他コスト無し → bare sleepSelf が正。B07020 の sleepSelf+removeFromHand pay ラッパとは異なる)。src/engine/cost/evaluate.ts:14 COST_KIND_MAP sleepSelf:true、:27-36 canPay 'sleepSelf' は source char が active のときのみ payable (rules/21 スリープ/スタンは支払不可で宣言不可)。pay.ts:36-40 が source.uid を setState 'sleep'。]
//   - 自分のデッキのカードを上から1枚公開する => atom deckRevealUntil {player:'self', maxN:1, filterAny:[...], bind:'$revealed', bindMatch:'$matched'} [src/cards/ct-p01/B01050.ts a2 step1 が「上から1枚公開」を deckRevealUntil maxN:1 + bind:'$revealed' + bindMatch:'$matched' で表現 (B03016 と同一テキスト構造)。src/engine/effect/atom-handlers.ts:1414-1432 maxN 分岐: lookN=min(deck,1) を全件 reveal → 最初の filter match を matched に採用。chooseMatch 無し = forced 型 (1442 の upTo 分岐に入らない=「手札に加える」必須)。validate.ts:36 deckRevealUntil 登録済。]
//   - 公開したカードが〚カード名［阿笠博士］〛か〚特徴［少年探偵団］〛のキャラの場合 => deckRevealUntil.filterAny:[{cardName:'阿笠博士',kind 'character'},{trait:'少年探偵団',kind 'character'}] [cross-field OR (cardName OR trait) = cluster16 G2 filterAny。LIVE コード src/engine/effect/atom-handlers.ts:1350-1361 が deckRevealUntil 経路で filterAny を honor: filter=(cardId)=>basePred(cardId) && anyPreds.some(p=>p(cardId)) (= AND-of(filter, OR(filterAny))、candidates.ts matchesFilters と同一意味論)。targetFilterToPredicate(atom-handlers.ts:65-117) が cardName(allCardNameComponentsForDef, split-name rules/19, :102-107)/trait(d.traits, :78-81)/kind(d.kind===filter.kind, :93)を評価。exemplar src/cards/ct-p07/B07020.ts a1 が filterAny:[{cardName,kind 'character'},{trait,kind 'character'}] を実出荷。「…のキャラ」= 両 OR 枝に kind 'character' (B07020 と同形)。]
//   - (公開カードが該当の場合)手札に加える => conditional {if:bound $matched matched, then:atom handAddFromDeck {player:'self', cardId:'$matched.cardId'}} [src/cards/ct-p01/B01050.ts a2 step2 が完全同型 (条件付きで $matched.cardId を handAddFromDeck、optional/upTo 無し=必須)。B01050 公式Q&A『該当でも手札に加えずデッキ下にできるか→いいえ必ず加えます』= plain conditional で必須。B03016 も「の場合、手札に加える」=必須。cond/eval.ts bound{presence:'matched'} = 非空配列。handAddFromDeck が deck から $matched.cardId を splice→hand。validate.ts:25 登録済。]
//   - 公開したカードがそれ以外の場合、デッキの下に移す => atom deckToBottomBound {player:'self', bindKey:'$revealed'} [src/cards/ct-p01/B01050.ts a2 step3 が完全同型。相互排他は $revealed bind で成立: match 時は $matched=[card] かつ $revealed=[] (atom-handlers.ts:1488-1497 が matched を revealed から除外) → deckToBottomBound は bound.length===0 で early return (:1517)。非 match 時は $matched=[] (conditional skip)、$revealed=[card] → デッキ下。deckToBottomBound(:1515+) が deck から splice→mutate.deck.toBottom。validate.ts:36 登録済。]

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'declared',
  scope: 'on-scene',
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
          filterAny: [
            {
              cardName: '阿笠博士',
              kind: 'character'
            },
            {
              trait: '少年探偵団',
              kind: 'character'
            }
          ],
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
  description: '【宣言】【スリープ】：自分のデッキのカードを上から1枚公開する。公開したカードが〚カード名［阿笠博士］〛か〚特徴［少年探偵団］〛のキャラの場合、手札に加える。公開したカードがそれ以外の場合、デッキの下に移す。',
  ruleRefs: [
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md',
    'rules/26-qa-deck-refresh.md'
  ]
};

export const B03016: CardDef = {
  id: 'B03016',
  no: '0274/B03016',
  kind: 'character',
  names: [
    '円谷光彦'
  ],
  colors: [
    '青'
  ],
  level: 4,
  ap: 4000,
  lp: 1,
  traits: [
    '少年探偵団'
  ],
  rarity: 'C',
  imageUrl: '1729133201215958.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/20-color-and-switch.md',
    'rules/21-declared-ability-cost.md',
    'rules/26-qa-deck-refresh.md'
  ],
};
