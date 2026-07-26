// cards/ct-p07/B07051 桃井恵子 (character) — cluster16 G2 follow-up (engine変更0)
// rules: rules/14-refresh.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/21-declared-ability-cost.md, rules/26-qa-deck-refresh.md
// 公式テキスト:
//   【宣言】【スリープ】：自分のデッキのカードを上から1枚公開する。公開したカードが〚カード名［怪盗キッド］〛か〚特徴［高校生］〛のキャラの場合、手札に加える。公開したカードがそれ以外の場合、デッキの下に移す。
// 句マッピング (B03016 円谷光彦 = 文字単位で同型の出荷済 twin。leaf literal 2 箇所のみ差替):
//   - 【宣言】 => ability.type='declared', scope='on-scene' [B03016 a1 / B01048 a1 と同形。canDeclaredAbility が cost.canPay でゲート。]
//   - 【スリープ】：(コロン左にスリープのみ、他コスト無し) => cost:{kind:'sleepSelf'} [B03016 a1 と同形 bare sleepSelf。cost/evaluate.ts:27-36 canPay 'sleepSelf' は source active 時のみ payable (rules/21 スリープ/スタンは支払不可で宣言不可)。]
//   - 自分のデッキのカードを上から1枚公開する => atom deckRevealUntil {player:'self', maxN:1, filterAny:[...], bind:'$revealed', bindMatch:'$matched'} [B03016 a1 step1 と同形。atom-handlers.ts:1414-1432 maxN:1 分岐: lookN=min(deck,1) を全件 reveal → 最初の filter match を matched に採用。chooseMatch 無し = forced 型 (「手札に加える」必須)。]
//   - 公開したカードが〚カード名［怪盗キッド］〛か〚特徴［高校生］〛のキャラの場合 => deckRevealUntil.filterAny:[{cardName:'怪盗キッド',kind:'character'},{trait:'高校生',kind:'character'}] [cross-field OR (cardName OR trait) = cluster16 G2 filterAny (engine SHA 1895184f)。atom-handlers.ts:1350-1361 deckReveal 経路で filter=(id)=>basePred(id)&&anyPreds.some(p=>p(id))。cardName '怪盗キッド' は同 pkg B07035 a1 で実出荷済の literal (allCardNameComponentsForDef split-name, atom-handlers.ts:102-107)。trait '高校生' は本カード自身の特徴で、targetFilterToPredicate(:78-81) が d.traits で評価。「…のキャラ」= 両 OR 枝に kind:'character' (B03016/B07020 と同形)。]
//   - (公開カードが該当の場合)手札に加える => conditional {if:bound $matched matched, then:atom handAddFromDeck {player:'self', cardId:'$matched.cardId'}} [B03016 a1 step2 と完全同型 (必須・optional 無し)。B01050 公式Q&A『該当でも手札に加えずデッキ下にできるか→いいえ必ず加えます』= plain conditional で必須。]
//   - 公開したカードがそれ以外の場合、デッキの下に移す => atom deckToBottomBound {player:'self', bindKey:'$revealed'} [B03016 a1 step3 と完全同型。相互排他は $revealed bind で成立: match 時は $matched=[card]・$revealed=[] (atom-handlers.ts:1488-1497 が matched を revealed から除外) → deckToBottomBound は bound.length===0 で early return。非 match 時は $revealed=[card] → デッキ下。]
//   - vanilla stats / 印字キーワード無し => keywords:[] (cutIn/hirameki/henso 空、effect に 迅速/突撃/疾風/ブレット 無し)

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
        args: { visibility: 'public', viewer: 'all',
          player: 'self',
          filterAny: [
            {
              cardName: '怪盗キッド',
              kind: 'character'
            },
            {
              trait: '高校生',
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
  description: '【宣言】【スリープ】：自分のデッキのカードを上から1枚公開する。公開したカードが〚カード名［怪盗キッド］〛か〚特徴［高校生］〛のキャラの場合、手札に加える。公開したカードがそれ以外の場合、デッキの下に移す。',
  ruleRefs: [
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md',
    'rules/26-qa-deck-refresh.md'
  ]
};

export const B07051: CardDef = {
  id: 'B07051',
  no: '0780/B07051',
  kind: 'character',
  names: [
    '桃井恵子'
  ],
  colors: [
    '白'
  ],
  level: 4,
  ap: 4000,
  lp: 1,
  traits: [
    '高校生'
  ],
  rarity: 'C',
  imageUrl: '1762414010582464.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md',
    'rules/26-qa-deck-refresh.md'
  ],
};
