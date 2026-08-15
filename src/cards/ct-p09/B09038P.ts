// cards/ct-p09/B09038P 黒羽盗一 (character) — Task A green候補 (engine変更0)
// rules: rules/09-cutin-disguise.md, rules/15-abilities-effects.md, rules/16-card-set.md, rules/17-icons.md, rules/19-special-rules.md, rules/20-color-and-switch.md, rules/23-qa-disguise-cutin.md
// 公式テキスト:
//   【変装時】自分のリムーブエリアにある〚カード名［工藤優作］〛を1枚まで選び、手札に加える。\n【登場時】このキャラをスリープさせてもよい。そうした場合、手札からレベル6以下の〚カード名［工藤優作］〛を1枚まで登場させ、自分のデッキのカードを上から1枚裏向きでそのキャラにセットし、カードを1枚引く。
//   【変装】【FILE7】 （手札から、コンタクト中のキャラと入れ替わる。入れ替わったキャラはデッキの下に移す）
// 句マッピング:
//   - 【変装時】 (disguise trigger) => triggered ability, trigger {hook 'disguise:into', selfOnly:true}, scope 'on-scene' [B02045.ts a2 + B04034 (disguise:into context): trigger {hook 'disguise:into', selfOnly:true}. capability-map Hooks: disguise:into is card-triggerable (TRIGGERED_HOOKS), payload {uid,fromCardId,newCardId}, source.uid=disguised char uid, selfOnly ✅. enter does NOT fire on disguise; disguise:into does (rules/09).]
//   - 自分のリムーブエリアにある〚カード名［工藤優作］〛を1枚まで選び、手札に加える => atom handAddFromRemove {player:'self', max:1, filter:{cardName:'工藤優作', kind 'character'}} [B04034.ts a3 VERBATIM: handAddFromRemove {player:'self', max:1, filter:{cardName:'鈴木園子', kind 'character'}}. capability-map: handAddFromRemove short-form defaultArea=remove, max:1 => n.min:0 (0枚可='1枚まで', rules/15). cardName honored via allCardNameComponentsForDef (matchOneFilter). 工藤優作 has character versions (B01052/D06016/B03048 等) so kind 'character' is correct + meaningful (excludes partner B02037).]
//   - 【登場時】 (enter trigger) => triggered ability, trigger {hook 'enter', selfOnly:true}, scope 'on-scene' [B05090.ts a1 / B04049.ts a1 VERBATIM: trigger {hook 'enter', selfOnly:true}. capability-map Hooks enter: card-triggerable, payload {uid,...}, selfOnly matches entering char source.uid (BUG-146 source unified to entering char).]
//   - このキャラをスリープさせてもよい。そうした場合〜 => optional{ chain[ sceneSetState{uid:'$self',state:'sleep'}, <rest> ] } [B04049.ts a1 VERBATIM: effect optional → chain whose first step is sceneSetState{uid:'$self',state:'sleep'} (=このキャラをスリープさせ…してもよい. そうした場合=chain). capability-map: optional runs effect only on player opt-in (human surface; AI default skip = legal '〜してもよい' decline, rules/15). resolveBindRef('$self')=ctx.source.uid. sceneSetState explicit-uid path (atom-handlers L972). Note (not a blocker): CPU never auto-takes optional self-cost (capability-map), faithful to optional decline.]
//   - 手札からレベル6以下の〚カード名［工藤優作］〛を1枚まで登場させ => atom sceneEnter {player:'self', from:'hand', cardId:'$pick.cardId', viaEffect:true, bind:'$entered', target:pick(area:'hand',side:'self',filter:{cardName:'工藤優作',levelMax:6,kind 'character'},n:{min:0,max:1},chooser:'self')} [B05090.ts a1 step1 VERBATIM structure (sceneEnter from:'hand', cardId:'$pick.cardId', viaEffect:true, bind:'$entered', target pick area:hand/side:self/filter color+levelMax+kind, n:0-1). B05055.ts a1 confirms from:'hand' + cardId:'$pick.cardId'. cardName/levelMax/kind all honored on hand pick path (matchOneFilter). n:0-1='1枚まで'=0OK (legalCount clamp). atom-handlers sceneEnter L743 resolveBindRef(cardId); hand source-area splice L796; bind writeback L827 ctx.bindings['$entered']=[{cardId,uid,...}]. No enterSleep (text says just '登場させ' = active/named default).]
//   - 自分のデッキのカードを上から1枚裏向きでそのキャラにセットし => conditional{ if:boundMatchesFilter{bindKey:'$entered',filter:{kind 'character'}}, then: atom charSetCard{uid:'$entered.uid', fromDeckTop:true, faceUp:false} } [B07058.ts a1 VERBATIM: conditional boundMatchesFilter{bindKey:'$entered',filter:{kind 'character'}} → charSetCard{uid:'$entered.uid', fromDeckTop:true, faceUp:false}. 'そのキャラ'=entered char: resolveBindRef('$entered.uid') (atom-handlers L161-199) returns binding[0].uid from sceneEnter bind writeback. charSetCard explicit-uid path (atom-handlers L1187 resolveBindRef(a.uid)=scUid; fromDeckTop L1196 shifts own deck top, empty-deck no-op; mutate.char.setCard faceUp:false). Gated on entered existing (0-enter => boundMatchesFilter false => set skipped) = 'そのキャラ' literal.]
//   - カードを1枚引く => atom draw {player:'self', n:1} (sequence trailing step, runs even on 0-enter) [B05090.ts a1 (draw {player:'self',n:1}) / B02020.ts a1 (draw after charSetCard, '別文=set 0枚でも実行'). Placed as final step of the inner sequence (NOT chain) so 0-enter does not break it (chain would stop on no-candidate; sequence steps are independent per capability-map). '1枚引く' is a separate sentence-final clause after the entire 'そうした場合' rest, so it occurs whenever sleep was taken (rules/15 '〜する'=必須).]
//   - 【変装】【FILE7】 (disguise capability gate) => icon-disguise ability with condition:{kind 'fileAtLeast', n:7} [B02045.ts a1 VERBATIM pattern: type 'icon-disguise' with condition (there caseColor+fileAtLeast). B09038 gate is FILE7 only => condition:{kind 'fileAtLeast', n:7}. capability-map: icon-disguise gate predicate = ability.condition evaluated by canDisguise; fileAtLeast (cond/eval.ts) = owner file.length>=n, assisted-partner counts (rules/17 §FILE). No case-color here, so single fileAtLeast.]

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: {
    hook: 'disguise:into',
    selfOnly: true
  },
  effect: {
    kind: 'atom',
    verb: 'handAddFromRemove',
    args: {
      player: 'self',
      max: 1,
      filter: {
        cardName: '工藤優作',
        kind: 'character'
      }
    }
  },
  description: '【変装時】自分のリムーブエリアにある〚カード名［工藤優作］〛を1枚まで選び、手札に加える。',
  ruleRefs: [
    'rules/09-cutin-disguise.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md'
  ]
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-scene',
  trigger: {
    hook: 'enter',
    selfOnly: true
  },
  effect: {
    kind: 'conditional',
    if: { kind: 'charStateIs', ref: { kind: 'self' }, state: 'active' },
    then: {
      kind: 'optional',
      effect: {
        kind: 'chain',
        steps: [
        {
          kind: 'atom',
          verb: 'sceneSetState',
          args: {
            uid: '$self',
            state: 'sleep'
          }
        },
        {
          kind: 'sequence',
          steps: [
            {
              kind: 'atom',
              verb: 'sceneEnter',
              args: {
                player: 'self',
                from: 'hand',
                cardId: '$pick.cardId',
                viaEffect: true,
                bind: '$entered',
                target: {
                  kind: 'pick',
                  query: {
                    area: 'hand',
                    side: 'self',
                    filter: {
                      cardName: '工藤優作',
                      levelMax: 6,
                      kind: 'character'
                    }
                  },
                  n: {
                    min: 0,
                    max: 1
                  },
                  chooser: 'self'
                }
              }
            },
            {
              kind: 'conditional',
              if: {
                kind: 'boundMatchesFilter',
                bindKey: '$entered',
                filter: {
                  kind: 'character'
                }
              },
              then: {
                kind: 'atom',
                verb: 'charSetCard',
                args: {
                  uid: '$entered.uid',
                  fromDeckTop: true,
                  faceUp: false
                }
              }
            },
            {
              kind: 'atom',
              verb: 'draw',
              args: {
                player: 'self',
                n: 1
              }
            }
          ]
          }
        ]
      }
    }
  },
  description: '【登場時】このキャラをスリープさせてもよい。そうした場合、手札からレベル6以下の〚カード名［工藤優作］〛を1枚まで登場させ、自分のデッキのカードを上から1枚裏向きでそのキャラにセットし、カードを1枚引く。',
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/16-card-set.md',
    'rules/17-icons.md',
    'rules/19-special-rules.md',
    'rules/20-color-and-switch.md'
  ]
};

const a3: AbilityDef = {
  id: 'a3',
  type: 'icon-disguise',
  condition: {
    kind: 'fileAtLeast',
    n: 7
  },
  description: '【変装】【FILE7】 （手札から、コンタクト中のキャラと入れ替わる。入れ替わったキャラはデッキの下に移す）',
  ruleRefs: [
    'rules/09-cutin-disguise.md',
    'rules/17-icons.md',
    'rules/23-qa-disguise-cutin.md'
  ]
};

export const B09038P: CardDef = {
  id: 'B09038P',
  no: '0981/B09038P',
  kind: 'character',
  names: [
    '黒羽盗一'
  ],
  colors: [
    '白'
  ],
  level: 7,
  ap: 5000,
  lp: 1,
  traits: [
    'マジシャン'
  ],
  rarity: 'RP',
  imageUrl: '1775608856058972.jpg',
  abilities: [a1, a2, a3],
  ruleRefs: [
    'rules/09-cutin-disguise.md',
    'rules/15-abilities-effects.md',
    'rules/16-card-set.md',
    'rules/17-icons.md',
    'rules/19-special-rules.md',
    'rules/20-color-and-switch.md',
    'rules/23-qa-disguise-cutin.md'
  ],
};
