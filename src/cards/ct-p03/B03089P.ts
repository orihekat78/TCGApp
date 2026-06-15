// cards/ct-p03/B03089P 黒田兵衛 (character) — Task A green候補 (engine変更0)
// rules: rules/05-turn-phases.md, rules/13-keywords.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/19-special-rules.md, rules/20-color-and-switch.md
// 公式テキスト:
//   【登場時】手札からレベル5以下の〚特徴［警察］〛のキャラを1枚まで登場させるか、自分のリムーブエリアにあるレベル5以下の〚特徴［警察］〛のキャラを1枚まで選び、登場させる。ターン終了時までそのキャラをAP＋2000し、〚突撃〛（登場したターンからすぐにアクションできる）と「ターン終了時、このキャラをリムーブする。」を与える。
// 句マッピング:
//   - 【登場時】 => AbilityDef type 'triggered' scope 'on-scene' trigger {hook 'enter', selfOnly:true} [capability-map hooks: enter (【登場時】/【疾風N】, selfOnly=source.uid一致). Exemplar src/cards/ct-p07/B07021.ts a2 (trigger {hook 'enter',selfOnly:true}) と src/cards/ct-p01/B01014.ts a1 がVERBATIM。BUG-146 で enter emit source = 登場キャラに統一済 → selfOnly が自カードの登場に正しく一致 (triggered.ts selfOnlyMatches scene: source.uid===card.uid)。]
//   - 手札から…登場させる か、自分のリムーブエリアにある…登場させる (2つの登場元の真の2択) => top-level choice{chooser:'self', options:[hand-enter sequence, remove-enter sequence]} [src/cards/ct-p08/B08029.ts a1 の構造ノート (2026-06-12 敵対レビュー vitest 実証): sequence 内に choice を置くと choice resume ctx が pick continuation の bindings('$matched') を持たず grant が恒久 no-op になる → choice を最上位化し各 option に『登場(bind) + bind 参照 rider』の sequence を持たせるのが唯一の正パターン。B03089 は同じ enter→rider 構造を2登場元で複製するだけ。resolve-picks.ts: humanChooser&&options.length>1&&chooser!=='opp' で __pendingEffectChoiceSide を surface し resume を hold (capability-map wrappers §choice)。]
//   - 手札からレベル5以下の〚特徴［警察］〛のキャラを1枚まで登場させる => sceneEnter{player:'self', cardId:'$pick.cardId', from:'hand', viaEffect:true, bind:'$matched', target:{pick, area:'hand', side:'self', filter:{trait:'警察', levelMax:5, kind 'character'}, n:{min:0,max:1}, chooser:'self'}} [hand-enter+bind: src/cards/ct-d07/D07008.ts a1 (cardId:'$pick.cardId', from:'hand', bind:'$matched', target area:'hand' filter levelMax+kind 'character', n{0..1}) VERBATIM。trait filter: src/cards/ct-d08/D08024.ts (filter:{trait:'少年探偵団'})。bind writeback: atom-handlers.ts:828-831 ctx.bindings[bind]=[{uid:newChar.uid}]。kind 'character' は BUG-123 でイベント除外。n.min:0 = 「1枚まで」(rules/15)。trait/levelMax/kind は matchOneFilter で honor (capability-map TargetFilter)。]
//   - 自分のリムーブエリアにあるレベル5以下の〚特徴［警察］〛のキャラを1枚まで選び、登場させる => sceneEnter{player:'self', cardId:'$pick.cardId', from:'remove', viaEffect:true, bind:'$matched', target:{pick, area:'remove', side:'self', filter:{trait:'警察', levelMax:5, kind 'character'}, n:{min:0,max:1}, chooser:'self'}} [remove-enter+bind: src/cards/ct-p07/B07058.ts a1 (from:'remove', cardId:'$pick.cardId', bind:'$entered', target area:'remove' side:'self' filter{color,levelMax,kind character} n{0..1}) と src/cards/ct-p08/B08029.ts deployStep (from:'remove', bind:'$matched', filter cardName+levelMax+kind) がVERBATIM。trait filter は D08024 で remove 経路でも honor。]
//   - ターン終了時までそのキャラをAP＋2000し => charModifyAP{uid:'$matched.uid', delta:2000, scope 'turn'} [explicit-uid charModifyAP: atom-handlers.ts:1007-1014 resolveBindRef(a.uid)→mutate.char.modifyAP, scope 'turn'。src/cards/ct-p07/B07058.ts (charModifyAP{uid:'$entered.uid', delta:3000, scope 'turn'}) と src/cards/ct-p01/B01015.ts がVERBATIM。$matched.uid は sceneEnter の bind writeback で解決 (同一 continuation ctx、BUG-107)。0枚 enter 時は $matched 未書込 → uid 未解決 → silent no-op (atom-handlers.ts:1008 startsWith('$') guard)。turn-scope は endTurn clearTurnEffects('turn') で解除 (turn.ts)。]
//   - 〚突撃〛（登場したターンからすぐにアクションできる）を与える => charGrantKeyword{uid:'$matched.uid', kw:'突撃', scope 'turn'} [src/cards/ct-d07/D07008.ts a1 (charGrantKeyword{uid:'$matched.uid', kw:'突撃', scope 'turn'}) と src/cards/ct-p09/B09032.ts a1 がVERBATIM。atom-handlers.ts:1085-1105 explicit-uid resolveBindRef→mutate.char.grantKeyword。突撃 は read/keyword.ts が granted keyword を honor (名乗り例外 rules/13)。括弧書きは突撃の説明注記で別効果なし。turn-scope = clearTurnEffects('turn')。]
//   - 「ターン終了時、このキャラをリムーブする。」を与える => charSetTurnEffect{uid:'$matched.uid', key:'removeOnTurnEnd', val:true} [src/cards/ct-p09/B09032.ts a1 が同一テキスト『ターン終了時、このキャラをリムーブする。』を charSetTurnEffect{uid:'$picked.uid', key:'removeOnTurnEnd', val:true} で実装 (text twin)。typed flag: game-state.ts:44 removeOnTurnEnd:boolean。consume: turn.ts endTurn が removeOnTurnEnd===true の scene char を removeToRemove('effect') で除去 — 位置は phase:end:start trigger 発火後・clearTurnEffects('turn') 前 (順序安全)。removeToRemove は leave:to-remove 発火 = 【現場リムーブ時】整合 (rules/17)。変装引継ぎは turnEffects 自動 (char.ts:275, rules/23)。]
//   - 0枚選択時 (1枚まで=0可) の rider 不発 => uid:'$matched.uid' 未解決 → charModifyAP/charGrantKeyword/charSetTurnEffect 全て silent no-op (boundMatchesFilter guard 不要) [src/cards/ct-p08/B08029.ts a1 のコメント『uid:'$matched.uid' (登場 skip 時は未解決 bind → silent no-op = そのキャラ不在で付与なし)』で同方針を採用済。bind writeback は実際の enter 時のみ発火 (atom-handlers.ts:829)。3 verb とも startsWith('$') guard で no-op (capability-map)。]

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
    kind: 'choice',
    chooser: 'self',
    options: [
      {
        kind: 'sequence',
        steps: [
          {
            kind: 'atom',
            verb: 'sceneEnter',
            args: {
              player: 'self',
              cardId: '$pick.cardId',
              from: 'hand',
              viaEffect: true,
              bind: '$matched',
              target: {
                kind: 'pick',
                query: {
                  area: 'hand',
                  side: 'self',
                  filter: {
                    trait: '警察',
                    levelMax: 5,
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
            kind: 'atom',
            verb: 'charModifyAP',
            args: {
              uid: '$matched.uid',
              delta: 2000,
              scope: 'turn'
            }
          },
          {
            kind: 'atom',
            verb: 'charGrantKeyword',
            args: {
              uid: '$matched.uid',
              kw: '突撃',
              scope: 'turn'
            }
          },
          {
            kind: 'atom',
            verb: 'charSetTurnEffect',
            args: {
              uid: '$matched.uid',
              key: 'removeOnTurnEnd',
              val: true
            }
          }
        ]
      },
      {
        kind: 'sequence',
        steps: [
          {
            kind: 'atom',
            verb: 'sceneEnter',
            args: {
              player: 'self',
              cardId: '$pick.cardId',
              from: 'remove',
              viaEffect: true,
              bind: '$matched',
              target: {
                kind: 'pick',
                query: {
                  area: 'remove',
                  side: 'self',
                  filter: {
                    trait: '警察',
                    levelMax: 5,
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
            kind: 'atom',
            verb: 'charModifyAP',
            args: {
              uid: '$matched.uid',
              delta: 2000,
              scope: 'turn'
            }
          },
          {
            kind: 'atom',
            verb: 'charGrantKeyword',
            args: {
              uid: '$matched.uid',
              kw: '突撃',
              scope: 'turn'
            }
          },
          {
            kind: 'atom',
            verb: 'charSetTurnEffect',
            args: {
              uid: '$matched.uid',
              key: 'removeOnTurnEnd',
              val: true
            }
          }
        ]
      }
    ]
  },
  description: '【登場時】手札からレベル5以下の〚特徴［警察］〛のキャラを1枚まで登場させるか、自分のリムーブエリアにあるレベル5以下の〚特徴［警察］〛のキャラを1枚まで選び、登場させる。ターン終了時までそのキャラをAP＋2000し、〚突撃〛（登場したターンからすぐにアクションできる）と「ターン終了時、このキャラをリムーブする。」を与える。',
  ruleRefs: [
    'rules/05-turn-phases.md',
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md'
  ]
};

export const B03089P: CardDef = {
  id: 'B03089P',
  no: '0342/B03089P',
  kind: 'character',
  names: [
    '黒田兵衛'
  ],
  colors: [
    '黄'
  ],
  level: 8,
  ap: 7000,
  lp: 2,
  traits: [
    '警察',
    '警視庁'
  ],
  rarity: 'RP',
  imageUrl: '1729133443663379.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/05-turn-phases.md',
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/19-special-rules.md',
    'rules/20-color-and-switch.md'
  ],
};
