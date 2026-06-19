// cards/ct-p03/B03056 千間降代 (character) — Task A green候補 (engine変更0)
// rules: rules/03-field-areas.md, rules/05-turn-phases.md, rules/11-reasoning.md, rules/14-refresh.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/26-qa-deck-refresh.md
// 公式テキスト:
//   【登場時】自分のデッキのカードを上から1枚見る。その中から〚特徴［探偵］〛のキャラを1枚まで公開して手札に加え、残りを好きな順番でデッキの下に移す。
//   自分のターン終了時、自分の現場に〚特徴［探偵］〛のスリープ状態のキャラが3枚以上いる場合、このキャラをリムーブしてもよい。そうした場合、証拠を1つ得る。
// 句マッピング:
//   - a1 【登場時】上から1枚見て探偵キャラ1枚まで手札→残りデッキ下
//     => enter→deckRevealUntil{maxN:1,chooseMatch:'upTo',filter:{trait:探偵,kind:character}}
//        →conditional[bound $matched matched: handAddFromDeck]→deckToBottomBound [B04024 a1 同型 (discard 無)]。
//        chooseMatch:'upTo' は公式Q&A「条件を満たすカードがあっても手札に加えないことは可能」(TSV qAndA) で 0枚可。
//   - a2 自分のターン終了時 => trigger{hook:'phase:end:start'} + condition{kind:'turn',player:'self'} [B06081/B07072 同型]。
//   - 自分の現場に探偵のスリープ≥3 いる場合 => sceneHas{query:{area:scene,side:self,filter:{trait:探偵,state:['sleep']}},nMin:3}
//        [D08003 a2 (trait) + B03009 a2 (state) を AND で結合。sceneHas は candidates() 経由で trait+state を AND honor
//         (cond/eval.ts:91)。自身も探偵なのでスリープなら計数 (テキストに自己除外なし=excludeSelf 無)]。
//   - このキャラをリムーブしてもよい。そうした場合、証拠を1つ得る
//     => optional{ sequence[ sceneRemove{uid:'$self',cause:'effect'}, evidenceGain{player:'self',n:1} ] }
//        [B08027/B05019/B07072 同型 (self-remove + then-effect)。「してもよい」=optional / 「そうした場合」= opt-in 時のみ後続]。
//   ⚠ 公式Q&A (TSV): 「解決前にこのキャラが現場を離れた場合は証拠を得られない (リムーブできないので)」。
//      sceneRemove{uid:'$self'} は char 不在時 no-op だが __chainStepNoApply を立てない (atom-handlers.ts:906)
//      ため、本 idiom (opt-in 後 char 不在) では evidenceGain が発火しうる = 既存 engine 規約の既知限界
//      (B08027/B05019/B07072/B09084 等の全 self-remove カード共通、本カード固有でない)。骨格凍結のため engine変更0 で
//      この規約に従う。実害は「opt-in 直後に他の同時ターン終了効果で自身が消える」極稀ケースのみ + AI は optional 不選択。

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
          chooseMatch: 'upTo',
          player: 'self',
          filter: {
            trait: '探偵',
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
  description: '【登場時】デッキ上から1枚見る → 特徴[探偵]のキャラを1枚まで手札 → 残りをデッキ下。',
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
  trigger: {
    hook: 'phase:end:start'
  },
  condition: {
    kind: 'and',
    cs: [
      {
        kind: 'turn',
        player: 'self'
      },
      {
        kind: 'sceneHas',
        query: {
          area: 'scene',
          side: 'self',
          filter: {
            trait: '探偵'
          },
          state: ['sleep']
        },
        nMin: 3
      }
    ]
  },
  effect: {
    kind: 'optional',
    effect: {
      kind: 'sequence',
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
          verb: 'evidenceGain',
          args: {
            player: 'self',
            n: 1
          }
        }
      ]
    }
  },
  description: '自分のターン終了時、自分の現場に特徴[探偵]のスリープ状態のキャラが3枚以上いる場合、このキャラをリムーブしてもよい。そうした場合、証拠を1つ得る。',
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/05-turn-phases.md',
    'rules/11-reasoning.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md'
  ]
};

export const B03056: CardDef = {
  id: 'B03056',
  no: '0311/B03056',
  kind: 'character',
  names: [
    '千間降代'
  ],
  colors: [
    '白'
  ],
  level: 6,
  ap: 4000,
  lp: 1,
  traits: [
    '探偵'
  ],
  keywords: [],
  rarity: 'C',
  imageUrl: '1729133406744648.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/05-turn-phases.md',
    'rules/11-reasoning.md',
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/26-qa-deck-refresh.md'
  ],
};
