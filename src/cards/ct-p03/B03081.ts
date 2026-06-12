// cards/ct-p03/B03081 「吹っ飛べェ!!」 (event) — Task A green候補 (engine変更0)
// rules: rules/03-field-areas.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/20-color-and-switch.md
// 公式テキスト:
//   【パートナー赤】相手の現場にいるキャラを1枚まで選び、手札に移す。相手は手札を1枚リムーブする。
// 句マッピング:
//   - 【パートナー赤】(使用条件) => ability.condition {kind:'partnerColor',color:'赤'} [cond/eval.ts partnerColor (owner partner CardDef.colors intersect color); exemplar src/cards/ct-p02/B02083.ts a1 condition:{kind:'partnerColor',color:'黄'} (same gate, 黄 variant). rules/17: 条件未満は能力を持たない扱い]
//   - イベント自己使用トリガ (このイベントを使用したとき) => trigger {hook:'effect:declared', selfOnly:true, __eventUse:true}, scope:'on-hand' [listeners/triggered.ts effect:declared on-hand (payload {kind:'event-use',cardId}); selfOnly matches payload.cardId+source.player. __eventUse is codegen flag → matcher (p)=>p.kind==='event-use' per certify-brief.md. Verbatim exemplar src/cards/ct-p02/B02083.ts a1 and src/cards/ct-p02/B02053.ts a1 (same scope/trigger/matcher)]
//   - 相手の現場にいるキャラを1枚まで選び、手札に移す => atom sceneToHand {uid:'$pick', target:{kind:'pick',query:{area:'scene',side:'opp'},n:{min:0,max:1},chooser:'self'}} [atom-handlers.ts case 'sceneToHand' (line 669): mutate.scene.toHand bounces char to OWNER's hand — for an opp char that is the opponent's hand, matching '相手の...手札に移す'. Exact pick arg shape from src/cards/ct-d09/D09015.ts a2 (uid:'$pick', query area:'scene' side:'opp', n:{min:0,max:1}, chooser:'self'). No state/level/trait filter (text restricts only to 'キャラ', any opp scene char). n.min:0 = 「〜まで」 0-pick legal. side:'opp' = 相手の現場]
//   - 相手は手札を1枚リムーブする => atom discard {player:'opp', n:1} [atom-handlers.ts case 'discard' (line 249): resolvePlayer('opp') + short-form buildShortFormPick(hand) → opponent picks 1 of own hand cards (byPlayer=opp), mutate.hand.discardToRemove. Verbatim exemplar src/cards/ct-d04/D04010.ts a1: effect {kind:'atom',verb:'discard',args:{player:'opp',n:1}} with description '相手は手札を1枚リムーブする。' (identical clause)]

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-hand',
  condition: {
    kind: 'partnerColor',
    color: '赤'
  },
  trigger: {
    hook: 'effect:declared',
    selfOnly: true,
    matcher: (p: unknown) => (p as { kind?: unknown })?.kind === 'event-use'
  },
  effect: {
    kind: 'sequence',
    steps: [
      {
        kind: 'atom',
        verb: 'sceneToHand',
        args: {
          uid: '$pick',
          target: {
            kind: 'pick',
            query: {
              area: 'scene',
              side: 'opp'
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
        verb: 'discard',
        args: {
          player: 'opp',
          n: 1
        }
      }
    ]
  },
  description: '【パートナー赤】相手の現場にいるキャラを1枚まで選び、手札に移す。相手は手札を1枚リムーブする。',
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/20-color-and-switch.md'
  ]
};

export const B03081: CardDef = {
  id: 'B03081',
  no: '0335/B03081',
  kind: 'event',
  names: [
    '「吹っ飛べェ!!」'
  ],
  colors: [
    '赤'
  ],
  level: 5,
  traits: [],
  rarity: 'C',
  imageUrl: '1729133424915804.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/20-color-and-switch.md'
  ],
};
