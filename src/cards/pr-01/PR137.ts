// cards/pr-01/PR137 工藤優作 (character) — Task A green候補 (engine変更0)
// rules: rules/15-abilities-effects.md, rules/17-icons.md, rules/05-turn-phases.md, rules/03-field-areas.md, rules/24-qa-naming-stun.md, rules/14-refresh.md
// 公式テキスト:
//   【パートナー白】【登場時】以下から1つ選んで行う。\n・【FILE7】自分のデッキのカードを上から4枚リムーブしてもよい。そうした場合、レベル7以下のスリープ状態のキャラを1枚まで選び、スタンさせる。（スタン状態のキャラをアクティブにする場合、代わりにスリープさせる）\n・カードを2枚引き、手札を2枚リムーブする。
// 句マッピング:
//   - 【パートナー白】 => ability-level condition partnerColor{color:'白'} (gates whole 【登場時】; rules/17 条件未達=能力不所持) [condition partnerColor — verbatim {kind:'partnerColor',color:'白'} on a triggered ability in src/cards/ct-d06/D06010.ts a2 and src/cards/ct-d03/D03002.ts a1; capability-map §E partnerColor (cond/eval.ts: owner partner colors intersect)]
//   - 【登場時】 => trigger:{hook:'enter',selfOnly:true}, scope:'on-scene' [enter selfOnly trigger — verbatim in src/cards/ct-p04/B04005.ts a1 and src/cards/ct-d07/D07008-class; capability-map hook 'enter' (selfOnly via source.uid, emitted by sceneEnter/next-hint/hand-use)]
//   - 以下から1つ選んで行う (2択, 単一選択) => {kind:'choice',chooser:'self',options:[opt1,opt2]} [choice chooser:'self' with conditional/sequence options — src/cards/ct-p09/B09092.ts a1 (choice 2択, options are conditionals) and src/cards/ct-p04/B04005.ts a2; capability-map §C choice (single-select, NOT multi-select); validate accepts heterogeneous options (>=1 option)]
//   - 【FILE7】(option 1 ゲート) => conditional if:{kind:'fileAtLeast',n:7} inside choice option (条件外の択も選べる→no-op, Q&A) [fileAtLeast{n:7} — exemplar src/cards/ct-d09/D09014.ts a1 (cited in src/cards/ct-p04/B04023.ts comment) value n:7; capability-map §E fileAtLeast (file.length>=n, assisted-partner counts). choice-option-as-conditional pattern from src/cards/ct-p09/B09092.ts a1]
//   - 自分のデッキのカードを上から4枚リムーブしてもよい。そうした場合、 => {kind:'optional',effect:{kind:'chain',steps:[mill, ...]}} — 「してもよい」=optional, 「そうした場合」=chain [optional{chain[...]} idiom for 「してもよい。そうした場合」 — verbatim certified-green pattern in src/cards/pr-01/PR138.ts a1 and src/cards/ct-p08/B08088.ts a1; mill{player:'self',n:4} = atom mill, resolvePlayer('self') honored at src/engine/effect/atom-handlers.ts:307-313 → mutate.deck.removeFromTop (src/engine/mutate/deck.ts:72, Math.min(n,len) mills available, no throw). NOTE: mill is non-pick so never breaks chain — optional gate alone couples the two steps (faithful)]
//   - レベル7以下のスリープ状態のキャラを1枚まで選び、スタンさせる。（スタン状態のキャラをアクティブにする場合、代わりにスリープさせる） => atom sceneSetState{uid:'$pick',state:'stun',target:{query:{area:'scene',side:'either',filter:{levelMax:7},state:['sleep']},n:{min:0,max:1},chooser:'self'}}; parenthetical = engine-default stun behavior [VERBATIM pattern (only levelMax differs 5→7) in src/cards/ct-d03/D03004.ts a1 (「レベル5以下のスリープ状態のキャラを1枚まで選び、スタンさせる」 → state:'stun' set-target + query.state:['sleep'] candidate-filter + filter:{levelMax}); also src/cards/ct-p04/B04071.ts a1, src/cards/ct-p06/B06094.ts; capability-map verb sceneSetState (Pattern A pick; levelMax honored TargetFilter; query.state scene-char filter). 代わりにスリープ = rules/03/24 engine default]
//   - カードを2枚引き、手札を2枚リムーブする (option 2) => {kind:'sequence',steps:[draw{player:'self',n:2}, discard{player:'self',n:2}]} [VERBATIM 「【登場時】カードを2枚引き、手札を2枚リムーブする」 in src/cards/ct-p04/B04005.ts a1 → sequence[draw{n:2},discard{n:2}]; capability-map verbs draw (mutate.deck.draw) + discard (n exact-count pick, defaultArea=hand). draw{n:2}/discard{n:2} widely grounded (src/cards/ct-p09/B09018.ts, src/cards/ct-p04/B04005.ts)]

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
    kind: 'partnerColor',
    color: '白'
  },
  effect: {
    kind: 'choice',
    chooser: 'self',
    options: [
      {
        kind: 'conditional',
        if: {
          kind: 'fileAtLeast',
          n: 7
        },
        then: {
          kind: 'optional',
          effect: {
            kind: 'chain',
            steps: [
              {
                kind: 'atom',
                verb: 'mill',
                args: {
                  player: 'self',
                  n: 4
                }
              },
              {
                kind: 'atom',
                verb: 'sceneSetState',
                args: {
                  uid: '$pick',
                  state: 'stun',
                  target: {
                    kind: 'pick',
                    query: {
                      area: 'scene',
                      side: 'either',
                      filter: {
                        levelMax: 7
                      },
                      state: [
                        'sleep'
                      ]
                    },
                    n: {
                      min: 0,
                      max: 1
                    },
                    chooser: 'self'
                  }
                }
              }
            ]
          }
        }
      },
      {
        kind: 'sequence',
        steps: [
          {
            kind: 'atom',
            verb: 'draw',
            args: {
              player: 'self',
              n: 2
            }
          },
          {
            kind: 'atom',
            verb: 'discard',
            args: {
              player: 'self',
              n: 2
            }
          }
        ]
      }
    ]
  },
  description: '【パートナー白】【登場時】以下から1つ選んで行う。・【FILE7】自分のデッキのカードを上から4枚リムーブしてもよい。そうした場合、レベル7以下のスリープ状態のキャラを1枚まで選び、スタンさせる。（スタン状態のキャラをアクティブにする場合、代わりにスリープさせる）・カードを2枚引き、手札を2枚リムーブする。',
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/05-turn-phases.md',
    'rules/03-field-areas.md',
    'rules/24-qa-naming-stun.md'
  ]
};

export const PR137: CardDef = {
  id: 'PR137',
  no: '0622/PR137',
  kind: 'character',
  names: [
    '工藤優作'
  ],
  colors: [
    '白'
  ],
  level: 4,
  ap: 4000,
  lp: 1,
  traits: [
    '小説家'
  ],
  rarity: 'PR',
  imageUrl: '1747874027853127.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/05-turn-phases.md',
    'rules/03-field-areas.md',
    'rules/24-qa-naming-stun.md',
    'rules/14-refresh.md'
  ],
};
