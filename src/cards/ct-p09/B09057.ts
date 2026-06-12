// cards/ct-p09/B09057 アンドレ・キャメル (character) — Task A green候補 (engine変更0)
// rules: rules/17-icons.md, rules/21-declared-ability-cost.md, rules/13-keywords.md, rules/15-abilities-effects.md, rules/20-color-and-switch.md, rules/26-qa-deck-refresh.md, rules/03-field-areas.md
// 公式テキスト:
//   【登場時】このキャラをスリープさせてもよい。そうした場合、手札からレベル6以下の【黒】のキャラを1枚まで登場させる。\n【パートナー赤】【宣言】【ターン1】〚現場にいるレベル6以上の【黒】のキャラを1枚リムーブエリアに移す〛：カードを1枚引く。このキャラをアクティブにし、ターン終了時まで〚突撃［キャラ］〛を持つ。この能力は〚痕跡［発見済み］〛の（このゲーム中に相手がリフレッシュしていた）場合に宣言できる。
// 句マッピング:
//   - 【登場時】 => type:'triggered', scope:'on-scene', trigger:{hook:'enter', selfOnly:true} [hook 'enter' selfOnly — src/cards/ct-p05/B05090.ts a1 (trigger{hook:'enter',selfOnly:true}); B04049 a1 同型; capability-map hooks ref: enter emitted by atom-handlers sceneEnter, selfOnly=source.uid]
//   - このキャラをスリープさせてもよい。そうした場合、… => effect: {kind:'optional', effect:{kind:'chain', steps:[ sceneSetState{uid:'$self',state:'sleep'}, sceneEnter… ]}} [EXACT structural twin src/cards/ct-p04/B04049.ts a1: {kind:'optional',effect:{kind:'chain',steps:[ {sceneSetState uid:'$self',state:'sleep'}, … ]}} (text 'このキャラをスリープさせ…してもよい。そうした場合'). self-sleep via sceneSetState{uid:'$self',state:'sleep'} also in src/cards/ct-p01/B01011.ts:25. brief: 「してもよい。そうした場合」=optional, prefix=chain (前段 no-op→後段skip). chain won't break on sleep (self is always a candidate)]
//   - 手札からレベル6以下の【黒】のキャラを1枚まで登場させる => atom sceneEnter {player:'self', cardId:'$pick.cardId', from:'hand', viaEffect:true, target:{kind:'pick', query:{area:'hand', side:'self', filter:{color:'黒', levelMax:6, kind:'character'}}, n:{min:0,max:1}, chooser:'self'}} [EXACT shape src/cards/ct-p05/B05090.ts a1 step1 (sceneEnter from:'hand' filter:{color:'黄',levelMax:4,kind:'character'}, n{min:0,max:1}); B09025.ts a1 (sceneEnter from:'hand' cardName filter); capability-map atom sceneEnter from='hand' short-form pick; color/levelMax/kind all honored on hand pick via matchOneFilter (TargetFilter ref). '1枚まで'→nMin:0 (0-pick legal)]
//   - 【パートナー赤】 => condition: {kind:'partnerColor', color:'赤'} (AND-ed) [src/cards/ct-p03/B03067.ts a3 condition:{kind:'partnerColor',color:'赤'} on declared ability; capability-map cond 'partnerColor' = owner partner CardDef.colors intersects; BUG-099: declared-ability.ts:90-95 gates declarability via evalCond(condition)]
//   - 【宣言】 => type:'declared', scope:'on-scene' [src/cards/ct-p03/B03067.ts a3 (type:'declared', 【パートナー赤】【宣言】【ターン1】); capability-map §3 declared = player-declared, cost paid then effect]
//   - 【ターン1】 => limit:{kind:'turn', n:1} [src/cards/ct-p03/B03067.ts a3 limit:{kind:'turn',n:1}; capability-map: triggered/declared limit{kind:'turn',n} enforced (BUG-067) via declaredUseCount per uid+abilityId; declared-ability.ts:83-85]
//   - 〚現場にいるレベル6以上の【黒】のキャラを1枚リムーブエリアに移す〛 (cost) => cost:{kind:'removeFromScene', target:{kind:'pick', query:{area:'scene', side:'self', filter:{color:'黒', levelMin:6}}, n:{min:1,max:1}, chooser:'self'}, n:1} [EXACT pattern src/cards/ct-p03/B03067.ts a3 cost:{kind:'removeFromScene', target:{kind:'pick', query:{area:'scene', side:'self', filterAny:[{cardName,levelMin:7}]}, n:{min:1,max:1}, chooser:'self'}, n:1} (現場にいる…をリムーブ cost with scene pick). side:'self' per rules/21 (自分の省略). filter color/levelMin honored on scene pick (matchOneFilter). canPay: src/engine/cost/evaluate.ts removeFromScene = candidates(target)>=n; pay: src/engine/cost/pay.ts removeFromScene→removeToRemove('cost')]
//   - カードを1枚引く => atom draw {player:'self', n:1} [capability-map Draw § draw{player,n}; ubiquitous, e.g. src/cards/ct-p05/B05090.ts a1 draw{player:'self',n:1}]
//   - このキャラをアクティブにし => atom sceneSetState {uid:'$self', state:'active'} [EXACT src/cards/ct-p03/B03067.ts a3 effect sceneSetState{uid:'$self',state:'active'} (このキャラをアクティブにする); capability-map sceneSetState explicit-uid path honors uid:'$self'+state]
//   - ターン終了時まで〚突撃［キャラ］〛を持つ => atom charGrantKeyword {uid:'$self', kw:'突撃[キャラ]', scope:'turn'} [EXACT src/cards/ct-p05/B05089.ts a-effect charGrantKeyword{uid:'$self',kw:'突撃[キャラ]',scope:'turn'}; src/cards/ct-p03/B03087.ts:25, ct-d11/D11015.ts:35 同型; engine string for 〚突撃［キャラ］〛 = '突撃[キャラ]' (half-width brackets, confirmed B09094.ts grantKeywords ()=>['突撃[キャラ]'])]
//   - この能力は〚痕跡［発見済み］〛の（このゲーム中に相手がリフレッシュしていた）場合に宣言できる => condition: {kind:'scratchTrace', player:'self', v:'発見済'} (AND-ed with partnerColor) [EXACT src/cards/ct-p09/B09094.ts a2 / B09093.ts a2 condition:{kind:'scratchTrace',player:'self',v:'発見済'} (痕跡発見済; engine value '発見済' NOT '発見済み'). declared 宣言 gate = ability.condition via declared-ability.ts:90-95 evalCond (BUG-099); rules/26 痕跡=相手リフレッシュでのみ発見済]

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
          kind: 'atom',
          verb: 'sceneEnter',
          args: {
            player: 'self',
            cardId: '$pick.cardId',
            from: 'hand',
            viaEffect: true,
            target: {
              kind: 'pick',
              query: {
                area: 'hand',
                side: 'self',
                filter: {
                  color: '黒',
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
        }
      ]
    }
  },
  description: '【登場時】このキャラをスリープさせてもよい。そうした場合、手札からレベル6以下の【黒】のキャラを1枚まで登場させる。',
  ruleRefs: [
    'rules/17-icons.md',
    'rules/15-abilities-effects.md',
    'rules/20-color-and-switch.md',
    'rules/03-field-areas.md'
  ]
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'declared',
  scope: 'on-scene',
  condition: {
    kind: 'and',
    cs: [
      {
        kind: 'partnerColor',
        color: '赤'
      },
      {
        kind: 'scratchTrace',
        player: 'self',
        v: '発見済'
      }
    ]
  },
  limit: {
    kind: 'turn',
    n: 1
  },
  cost: {
    kind: 'removeFromScene',
    target: {
      kind: 'pick',
      query: {
        area: 'scene',
        side: 'self',
        filter: {
          color: '黒',
          levelMin: 6
        }
      },
      n: {
        min: 1,
        max: 1
      },
      chooser: 'self'
    },
    n: 1
  },
  effect: {
    kind: 'sequence',
    steps: [
      {
        kind: 'atom',
        verb: 'draw',
        args: {
          player: 'self',
          n: 1
        }
      },
      {
        kind: 'atom',
        verb: 'sceneSetState',
        args: {
          uid: '$self',
          state: 'active'
        }
      },
      {
        kind: 'atom',
        verb: 'charGrantKeyword',
        args: {
          uid: '$self',
          kw: '突撃[キャラ]',
          scope: 'turn'
        }
      }
    ]
  },
  description: '【パートナー赤】【宣言】【ターン1】〚現場にいるレベル6以上の【黒】のキャラを1枚リムーブエリアに移す〛：カードを1枚引く。このキャラをアクティブにし、ターン終了時まで〚突撃［キャラ］〛を持つ。この能力は〚痕跡［発見済み］〛の場合に宣言できる。',
  ruleRefs: [
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md',
    'rules/13-keywords.md',
    'rules/26-qa-deck-refresh.md',
    'rules/15-abilities-effects.md'
  ]
};

export const B09057: CardDef = {
  id: 'B09057',
  no: '0999/B09057',
  kind: 'character',
  names: [
    'アンドレ・キャメル'
  ],
  colors: [
    '赤'
  ],
  level: 7,
  ap: 5000,
  lp: 0,
  traits: [
    'FBI'
  ],
  rarity: 'R',
  imageUrl: '1775608872780004.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md',
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/20-color-and-switch.md',
    'rules/26-qa-deck-refresh.md',
    'rules/03-field-areas.md'
  ],
};
