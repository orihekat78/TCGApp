// cards/ct-p02/B02083 「いや、もうオトリはなしだ…」 (event) — Task A green候補 (engine変更0)
// rules: rules/03-field-areas.md, rules/11-reasoning.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/24-qa-naming-stun.md
// 公式テキスト:
//   【パートナー黄】相手の現場にいるスタン状態のキャラ1枚につき、カードを1枚引く。カードを1枚も引かなかった場合、キャラを1枚まで選び、スタンさせる。（スタン状態のキャラをアクティブにする場合、代わりにスリープさせる）
// 句マッピング:
//   - 【パートナー黄】(使用条件) => ability.condition partnerColor{color:'黄'} [cond/eval.ts partnerColor (owner partner colors intersect); exemplar src/cards/ct-p03/B03103.ts (同色黄イベント, condition:{kind:'partnerColor',color:'黄'}); rules/17 条件未満は能力を持たない扱い]
//   - イベント自己使用トリガ (このイベントを使用したとき) => trigger{hook:'effect:declared',selfOnly:true,__eventUse:true} [listeners/triggered.ts effect:declared on-hand (payload kind:'event-use'); scripts/taskA-codegen.cjs:108-120 __eventUse→matcher(p)=>p.kind==='event-use'; exemplar B03103.ts / B02032.ts (同型 matcher)]
//   - 相手の現場にいるスタン状態のキャラ1枚につき、カードを1枚引く => forEach over:{kind:'all',query:{area:'scene',side:'opp',state:['stun']}} do:{atom draw{player:'self',n:1}} [resolver.ts:121-138 forEach runs do once per candidate; target/resolve.ts:22-24 all→candidates(); target/candidates.ts:187-188 query.state honored (c.state membership); atom draw atom-handlers.ts:235 (n literal number, requireField); forEach-over-all+state exemplar src/cards/ct-p06/B06071.ts:27, forEach-over-all event-use exemplar B02032.ts; draw n:1 used in dozens of cards]
//   - カードを1枚も引かなかった場合 (=相手現場にスタン状態のキャラが0体) => conditional if:not(sceneHas{query:{area:'scene',side:'opp',state:['stun']},nMin:1}) [cond/eval.ts:90-94 sceneHas uses candidates(all,query) → query.state honored (candidates.ts:187); not combinator eval.ts; exemplar sceneHas+state src/cards/ct-p07/B07056.ts:24; conditional if/then exemplar B03103.ts. NOTE: engine cannot read literal draw-count, so 「引かなかった」 is mapped to the equivalent board predicate 「スタン対象0体」 (exact in all normal states — drawing does not alter opp scene)]
//   - キャラを1枚まで選び、スタンさせる => atom sceneSetState{uid:'$pick',state:'stun',target:{kind:'pick',query:{area:'scene',side:'either'},n:{min:0,max:1},chooser:'self'}} [atom-handlers.ts sceneSetState short-form/$pick (state target, side either pick); exact exemplar src/cards/ct-d03/D03002.ts:31 「キャラを1枚まで選び、スタンさせる」 = same arg shape; 「キャラ」エリア指定なし→both sides per rules/15 → side:'either'; n.min:0 = 「〜まで」 0-pick legal]
//   - （スタン状態のキャラをアクティブにする場合、代わりにスリープさせる） => engine setState semantics (no card-specific clause) [generic stun rule rules/03-field-areas.md / 24-qa-naming-stun.md handled by mutate.scene.setState; printed reminder, not a separate effect]

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-hand',
  condition: {
    kind: 'partnerColor',
    color: '黄'
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
        kind: 'forEach',
        over: {
          kind: 'all',
          query: {
            area: 'scene',
            side: 'opp',
            state: [
              'stun'
            ]
          }
        },
        do: {
          kind: 'atom',
          verb: 'draw',
          args: {
            player: 'self',
            n: 1
          }
        }
      },
      {
        kind: 'conditional',
        if: {
          kind: 'not',
          c: {
            kind: 'sceneHas',
            query: {
              area: 'scene',
              side: 'opp',
              state: [
                'stun'
              ]
            },
            nMin: 1
          }
        },
        then: {
          kind: 'atom',
          verb: 'sceneSetState',
          args: {
            uid: '$pick',
            state: 'stun',
            target: {
              kind: 'pick',
              query: {
                area: 'scene',
                side: 'either'
              },
              n: {
                min: 0,
                max: 1
              },
              chooser: 'self'
            }
          }
        }
      }
    ]
  },
  description: '【パートナー黄】相手の現場にいるスタン状態のキャラ1枚につき、カードを1枚引く。カードを1枚も引かなかった場合、キャラを1枚まで選び、スタンさせる。（スタン状態のキャラをアクティブにする場合、代わりにスリープさせる）',
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/11-reasoning.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/24-qa-naming-stun.md'
  ]
};

export const B02083: CardDef = {
  id: 'B02083',
  no: '0244/B02083',
  kind: 'event',
  names: [
    '「いや、もうオトリはなしだ…」'
  ],
  colors: [
    '黄'
  ],
  level: 4,
  traits: [],
  rarity: 'C',
  imageUrl: '1721357284550456.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/11-reasoning.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/24-qa-naming-stun.md'
  ],
};
