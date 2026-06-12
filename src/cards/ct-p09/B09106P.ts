// cards/ct-p09/B09106P 暗殺計画 (event) — Task A green候補 (engine変更0)
// rules: rules/14-refresh.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/20-color-and-switch.md, rules/10-action-event.md
// 公式テキスト:
//   【事件赤＆黒】レベル7以下のキャラを1枚まで選び、リムーブする。〚痕跡［発見済み］〛の（このゲーム中に相手がリフレッシュしていた）場合、自分のリムーブエリアにあるレベル4以下の【赤】か【黒】のキャラを1枚まで選び、登場させる。〚痕跡［未発見］〛の場合、相手のデッキのカードを上から3枚リムーブする。
// 句マッピング:
//   - 【事件赤＆黒】(使用条件ゲート) => ability.condition caseColor{color:['赤','黒'],combine:'and'} [caseColor combine:'and' = 事件が赤と黒の両方を持つ (rules/17 「&」全色必要). Exact shape from src/cards/ct-p09/B09092.ts a2 line75 (同set同型). Honored by src/engine/cond/eval.ts caseColor (combine:'and' ⇒ must have ALL).]
//   - イベント自己使用トリガ (このイベントを使用したとき効果発動) => type:'triggered',scope:'on-hand',trigger:{hook:'effect:declared',selfOnly:true,__eventUse:true} [Event self-use shape from src/cards/ct-p02/B02053.ts a1 + src/cards/ct-d08/D08024.ts a1 (effect:declared selfOnly + matcher kind==='event-use'). __eventUse:true is the codegen flag (scripts/taskA-codegen.cjs) converting to matcher(p)=>p.kind==='event-use' per certify-brief.md; convention confirmed in src/cards/ct-p02/B02083.ts header comment. Hook emitted by src/engine/flow/main/hand-use-card.ts (payload kind:'event-use').]
//   - レベル7以下のキャラを1枚まで選び、リムーブする => atom sceneRemove{player:'self',max:1,side:'either',cause:'effect',filter:{levelMax:7}} [IDENTICAL arg shape (levelMax:7) from src/cards/ct-p09/B09101.ts a1 line21; sibling shape (levelMax:9) src/cards/ct-p09/B09092.ts a2 line79. side:'either' = エリア指定なしの「キャラ」=両現場 (rules/15). max:1 = 「1枚まで」0-pick legal (n.min auto 0). levelMax honored by candidates.ts matchOneFilter line294. → tier2 pick surface.]
//   - 〚痕跡［発見済み］〛の場合 (このゲーム中に相手がリフレッシュしていた場合) => conditional.if scratchTrace{player:'self',v:'発見済'} [engine 値は '発見済' (without 「み」) per capability-map cond ref line171 + exemplars src/cards/ct-p09/B09092.ts a1 line40 / B09093.ts a2 / B09094.ts a2. Evaluated by src/engine/cond/eval.ts scratchTrace (state.scratchTrace[p] equals; own-refresh never 発見済 enforced elsewhere).]
//   - 自分のリムーブエリアにあるレベル4以下の【赤】か【黒】のキャラを1枚まで選び、登場させる => atom sceneEnter{player:'self',from:'remove',max:1,viaEffect:true,filter:{color:['赤','黒'],levelMax:4,kind:'character'}} [Reanimate-from-remove shape from src/cards/ct-p02/B02053.ts a1 (sceneEnter from:'remove',max:1,viaEffect:true,filter:{color,trait,levelMax,kind}) + src/cards/ct-d08/D08024.ts a1. color:['赤','黒'] = 「【赤】か【黒】」OR membership — honored by src/engine/target/candidates.ts matchOneFilter line253-256 (wants.some). levelMax:4 line294, kind:'character' line~288 (c===null remove-cand uses printed level/def.kind). Remove-area candidates built candidates.ts case 'remove' line139-147 → matchesFiltersByCardId → matchOneFilter. → tier2 pick surface.]
//   - 〚痕跡［未発見］〛の場合 => conditional.if scratchTrace{player:'self',v:'未発見'} [engine 値 '未発見' per capability-map line171 + exemplar src/cards/ct-p09/B09092.ts a1 line59 / B09094.ts a3. Evaluated by cond/eval.ts scratchTrace.]
//   - 相手のデッキのカードを上から3枚リムーブする => atom mill{player:'opp',n:3} [IDENTICAL verb/shape from src/cards/ct-p09/B09094.ts a3 (mill opp 2) + B09092.ts a1 option2 (mill opp 4). mill = mutate.deck.removeFromTop (capability-map line18). Deck shortage = remove possible→refresh→no extra removal handled in engine (rules/14,26).]

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-hand',
  trigger: {
    hook: 'effect:declared',
    selfOnly: true,
    matcher: (p: unknown) => (p as { kind?: unknown })?.kind === 'event-use'
  },
  condition: {
    kind: 'caseColor',
    color: [
      '赤',
      '黒'
    ],
    combine: 'and'
  },
  effect: {
    kind: 'sequence',
    steps: [
      {
        kind: 'atom',
        verb: 'sceneRemove',
        args: {
          player: 'self',
          max: 1,
          side: 'either',
          cause: 'effect',
          filter: {
            levelMax: 7
          }
        }
      },
      {
        kind: 'conditional',
        if: {
          kind: 'scratchTrace',
          player: 'self',
          v: '発見済'
        },
        then: {
          kind: 'atom',
          verb: 'sceneEnter',
          args: {
            player: 'self',
            from: 'remove',
            max: 1,
            viaEffect: true,
            filter: {
              color: [
                '赤',
                '黒'
              ],
              levelMax: 4,
              kind: 'character'
            }
          }
        }
      },
      {
        kind: 'conditional',
        if: {
          kind: 'scratchTrace',
          player: 'self',
          v: '未発見'
        },
        then: {
          kind: 'atom',
          verb: 'mill',
          args: {
            player: 'opp',
            n: 3
          }
        }
      }
    ]
  },
  description: '【事件赤＆黒】レベル7以下のキャラを1枚まで選び、リムーブする。〚痕跡［発見済み］〛の場合、自分のリムーブエリアにあるレベル4以下の【赤】か【黒】のキャラを1枚まで選び、登場させる。〚痕跡［未発見］〛の場合、相手のデッキのカードを上から3枚リムーブする。',
  ruleRefs: [
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/20-color-and-switch.md'
  ]
};

export const B09106P: CardDef = {
  id: 'B09106P',
  no: '1045/B09106P',
  kind: 'event',
  names: [
    '暗殺計画'
  ],
  colors: [
    '黒'
  ],
  level: 6,
  traits: [],
  rarity: 'CP',
  imageUrl: '1775608943998079.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/20-color-and-switch.md',
    'rules/10-action-event.md'
  ],
};
