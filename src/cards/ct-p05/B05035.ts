// cards/ct-p05/B05035 遠山和葉 (character) — BUG-153 解禁 (set-facedown host-check 修正後の再出荷)
// rules: rules/03-field-areas.md, rules/14-refresh.md, rules/15-abilities-effects.md, rules/16-card-set.md, rules/17-icons.md, rules/19-special-rules.md, rules/20-color-and-switch.md, rules/26-qa-deck-refresh.md
// 公式テキスト:
//   【登場時】自分のデッキのカードを上から1枚公開する。公開したカードが〚カード名［服部平次］〛か〚［遠山和葉］〛の場合、手札に加えてもよい。公開したカードを手札に加えなかった場合、裏向きでこのキャラにセットする。
// 公式Q&A (ct-p05/character.tsv B05035 qAndA):
//   - 公開カードが [服部平次]/[遠山和葉] 以外 → 手札に加えられないのでこのキャラにセット。
//     効果解決までにこのキャラが現場を離れていた場合、「裏向きでセット」が実行できないので公開カードは
//     **そのままデッキの上に戻す** (= BUG-153 修正: charSetCard fromDeckTop の host-check→shift 順)。
//   - セットした裏向きカードは他効果のセットカードと判別できる必要がある (engine: host.setCards[] が順序保持)。
//   - 裏向きセット = 「セット」イベント同様、host 離場時に表向きでリムーブエリアへ。情報を持たず
//     キャラ/イベント扱いされず、現場のキャラ数に数えない (engine: setCards は scene 配列に含まれない)。
// 句マッピング:
//   - 【登場時】 => a1 trigger {hook:'enter', selfOnly:true}, scope:'on-scene'
//     [B01050.ts a2 / B02019.ts a1 と同型。enter は全登場経路 (handUseCard/next-hint/sceneEnter) で発火。]
//   - 自分のデッキのカードを上から1枚公開する => deckRevealUntil {player:'self', maxN:1,
//     filter:{cardName:['服部平次','遠山和葉']}, chooseMatch:'upTo', bind:'$revealed', bindMatch:'$matched'}
//     [B01050.ts a2 (maxN:1 reveal) + B02019.ts a1 (chooseMatch:'upTo' decline channel) の合成。
//      maxN:1 → deck[0] を 1 枚 reveal。cardName 配列 = OR (rules/19 split-name 対応、
//      _shared.ts targetFilterToPredicate L110-114 wants.some(allCardNameComponentsForDef))。
//      公開自体は必須 (deckRevealUntil は常に reveal)、「加えてもよい」の任意性は chooseMatch:'upTo' が
//      decline channel を surface (human owner)。AI は先頭 match 自動取得 (rules/15 選択権、smoke 不変)。]
//   - 公開したカードが [服部平次]/[遠山和葉] の場合、手札に加えてもよい => conditional if{bound $matched
//     presence:'matched'} then handAddFromDeck {player:'self', cardId:'$matched.cardId'}
//     [B01050.ts a2 step2 / B02019.ts a1 step2 と同型。$matched は take 時のみ非空 (picks.ts L42-46);
//      decline (__declined) 時は $matched=[] かつ $revealed=[公開カード] (picks.ts L36-72) ゆえ加えない。]
//   - 公開したカードを手札に加えなかった場合、裏向きでこのキャラにセットする => conditional if{bound
//     $revealed presence:'matched'} then charSetCard {uid:'$self', fromDeckTop:true, faceUp:false, player:'self'}
//     [set-facedown は B03061.ts a1 と同 DSL (charSetCard fromDeckTop faceUp:false uid:'$self')。
//      gate: $revealed が非空 = 「公開したが手札に加えなかったカードがデッキ上端に残っている」状態
//      (take 時は handAddFromDeck が deck から splice 済 → $revealed=[] → skip。not-added は no-match/decline
//      とも $revealed=[公開カード]、cond/eval.ts L184-188 presence:'matched'=非空配列)。step 順序: handAdd が
//      matched を deck から除去 → charSetCard{fromDeckTop} は残った deck[0] (= 公開カード) を shift するので安全。
//      host (=$self) 離場時は BUG-153 修正で deck 上端に残す (Q&A 準拠)。faceUp:false=裏向き、
//      host.setCards[] 順序保持 ⇒ 判別可 / scene 数に非計上 (rules/16, Q&A)。]

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
          maxN: 1,
          chooseMatch: 'upTo',
          filter: {
            cardName: ['服部平次', '遠山和葉']
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
        kind: 'conditional',
        if: {
          kind: 'bound',
          key: '$revealed',
          presence: 'matched'
        },
        then: {
          kind: 'atom',
          verb: 'charSetCard',
          args: {
            uid: '$self',
            fromDeckTop: true,
            faceUp: false,
            player: 'self'
          }
        }
      }
    ]
  },
  description: '【登場時】自分のデッキのカードを上から1枚公開する。公開したカードが〚カード名［服部平次］〛か〚［遠山和葉］〛の場合、手札に加えてもよい。公開したカードを手札に加えなかった場合、裏向きでこのキャラにセットする。',
  ruleRefs: [
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/16-card-set.md',
    'rules/17-icons.md',
    'rules/19-special-rules.md',
    'rules/26-qa-deck-refresh.md'
  ]
};

export const B05035: CardDef = {
  id: 'B05035',
  no: '0539/B05035',
  kind: 'character',
  names: [
    '遠山和葉'
  ],
  colors: [
    '緑'
  ],
  level: 5,
  ap: 5000,
  lp: 0,
  traits: [
    '高校生'
  ],
  rarity: 'C',
  imageUrl: '1745322178465846.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/16-card-set.md',
    'rules/17-icons.md',
    'rules/19-special-rules.md',
    'rules/20-color-and-switch.md',
    'rules/26-qa-deck-refresh.md'
  ],
};
