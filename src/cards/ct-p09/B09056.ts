// cards/ct-p09/B09056 赤井秀一 (character) — Task A green候補 (engine変更0)
// rules: rules/03-field-areas.md, rules/14-refresh.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/20-color-and-switch.md, rules/26-qa-deck-refresh.md
// 公式テキスト:
//   【事件赤＆黒】【パートナー赤】【登場時】このキャラをスリープさせてもよい。そうした場合、レベル8以下のキャラを1枚まで選び、リムーブし、以下から1つ選んで行う。\n・〚痕跡［発見済み］〛の（このゲーム中に相手がリフレッシュしていた）場合、自分のリムーブエリアにあるレベル3以下の【黒】のキャラを1枚まで選び、スリープ状態で登場させる。\n・〚痕跡［未発見］〛の場合、相手の現場にいるキャラ1枚につき、相手のデッキのカードを上から2枚リムーブする。
// 句マッピング:
//   - 【事件赤＆黒】(ability-level icon gate) => ability.condition cs[0] = { kind 'caseColor', color:['赤','黒'], combine:'and' } [src/cards/ct-p08/B08005.ts a1 = and[{caseColor,color:['青','黒'],combine:'and'},{partnerColor,color:'青'}] — EXACT 【事件X＆Y】【パートナーZ】combo on a triggered ability. cond/eval.ts:45-56 caseColor combine:'and' → want.every(c=>have.includes(c)) over owner.case CardDef.colors. Only the two colors differ.]
//   - 【パートナー赤】(ability-level icon gate) => ability.condition cs[1] = { kind 'partnerColor', color:'赤' } [src/cards/ct-p04/B04049.ts a1 uses partnerColor color:'赤' on an 【登場時】 triggered ability (verbatim same icon). cond/eval.ts partnerColor = owner partner CardDef.colors intersects color.]
//   - このキャラをスリープさせてもよい => effect-time conditional charStateIs(self, active) gates the optional; the mandatory enter trigger still fires while sleep/stun (BUG-145).
//   - 【登場時】 => trigger { hook 'enter', selfOnly:true }, scope 'on-scene' [src/cards/ct-p04/B04049.ts a1 + ct-p05/B05116.ts a2 use trigger{hook 'enter',selfOnly:true}; cap-map hooks: enter=登場時, selfOnly matches entering char's source.uid.]
//   - このキャラをスリープさせてもよい。そうした場合、… => effect = conditional(active) → optional{ sequence[ sceneSetState $self sleep, sceneRemove…, conditional… ] }。mandatory triggerと実行可能性を分離 (BUG-145)。
//   - レベル8以下のキャラを1枚まで選び、リムーブし => sceneRemove { player:'self', max:1, side:'either', cause:'effect', filter:{levelMax:8} } [src/cards/ct-p04/B04049.ts a1 step = sceneRemove{player:'self',max:1,side:'either',cause:'effect',filter:{levelMax:7}} for 「レベル7以下のキャラを1枚まで選び、リムーブする」 (only levelMax 7→8). side:'either'=エリア指定なし=両現場 (rules/15). max:1→n.min:0 (「1枚まで」=0枚可).]
//   - 以下から1つ選んで行う => choice を常に提示し、各 option 内で痕跡条件を評価する。公式Q&Aは条件不成立側も選べて no-op と明記。BUG-111 修正済みの sequence→choice continuation を使用する。
//   - 〚痕跡［発見済み］〛の場合、自分のリムーブエリアにあるレベル3以下の【黒】のキャラを1枚まで選び、スリープ状態で登場させる => then = sceneEnter { player:'self', from:'remove', max:1, viaEffect:true, enterSleep:true, filter:{color:'黒', levelMax:3, kind 'character'} } [src/cards/ct-p05/B05116.ts a2 = sceneEnter{player:'self',from:'remove',max:1,viaEffect:true,enterSleep:true,filter:{color:'黒',levelMax:4,kind 'character'}} for 「自分のリムーブエリアにあるレベル4以下の【黒】のキャラを1枚まで選び、スリープ状態で登場させる」 (only levelMax 4→3). cap-map sceneEnter from+max short-form builds a remove-area pick ($pick.cardId) via tryRePickFromAtom — re-enqueues as a fresh pending pick even inside the continuation (sequential nested pick, same mechanism as B04049's 2nd pick). remove pick needs kind 'character' (BUG-123); color/levelMax/kind honored on remove candidate (CardDef statics, c===null). enterSleep:true=スリープ状態で登場.]
//   - 〚痕跡［未発見］〛の場合、相手の現場にいるキャラ1枚につき、相手のデッキのカードを上から2枚リムーブする => else = forEach over:{kind 'all', query:{area:'scene', side:'opp'}} do: mill{player:'opp', n:2} [src/cards/ct-p07/B07104.ts a1 = forEach over:{kind 'all',query:{area:'scene',side:'either'}} do:mill{player:'self',n:2} for 「…現場にいるキャラ1枚につき、…デッキのカードを上から2枚リムーブする」 (here side:'opp' + mill player:'opp' since text is 相手の現場/相手のデッキ). resolver.ts:143-159 forEach resolves over via resolveTarget and runs do per candidate (continuation-safe). mill opp grounded by ct-p09/B09099.ts (mill opp n:1) and B09104.ts (mill opp n:4). dyn/eval.ts has NO opponent-scene-count token (resolveSelf whitelist = sceneTrait/faceUpEvidence/fileCount/ap/lp/uid/cardId/setCardCount only) → forEach-over-all is the engine-supported per-count idiom (memory 21460). KNOWN-EDGE inherited from B07104 (shipped GREEN): if opp deck depletes mid-forEach, refresh then later iterations mill from the refreshed deck — diverges from official 'mill total then stop at refresh' only in late-game deck-depletion; accepted per B07104 precedent.]

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  condition: {
    kind: 'and',
    cs: [
      {
        kind: 'caseColor',
        color: [
          '赤',
          '黒'
        ],
        combine: 'and'
      },
      {
        kind: 'partnerColor',
        color: '赤'
      }
    ]
  },
  trigger: {
    hook: 'enter',
    selfOnly: true
  },
  effect: {
    kind: 'conditional',
    if: {
      kind: 'charStateIs',
      ref: {
        kind: 'self'
      },
      state: 'active'
    },
    then: {
      kind: 'optional',
      effect: {
        kind: 'sequence',
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
          verb: 'sceneRemove',
          args: {
            player: 'self',
            max: 1,
            side: 'either',
            cause: 'effect',
            filter: {
              levelMax: 8
            }
          }
        },
        {
          kind: 'choice',
          chooser: 'self',
          options: [
            {
              kind: 'conditional',
              if: { kind: 'scratchTrace', player: 'self', v: '発見済' },
              then: {
                kind: 'atom',
                verb: 'sceneEnter',
                args: {
                  player: 'self', from: 'remove', max: 1, viaEffect: true, enterSleep: true,
                  filter: { color: '黒', levelMax: 3, kind: 'character' }
                }
              }
            },
            {
              kind: 'conditional',
              if: { kind: 'scratchTrace', player: 'self', v: '未発見' },
              then: {
                kind: 'forEach',
                over: { kind: 'all', query: { area: 'scene', side: 'opp' } },
                do: { kind: 'atom', verb: 'mill', args: { player: 'opp', n: 2 } }
              }
            }
          ]
        }
        ]
      }
    }
  },
  description: '【事件赤＆黒】【パートナー赤】【登場時】このキャラをスリープさせてもよい。そうした場合、レベル8以下のキャラを1枚まで選び、リムーブし、以下から1つ選んで行う。 ・〚痕跡［発見済み］〛の場合、自分のリムーブエリアにあるレベル3以下の【黒】のキャラを1枚まで選び、スリープ状態で登場させる。 ・〚痕跡［未発見］〛の場合、相手の現場にいるキャラ1枚につき、相手のデッキのカードを上から2枚リムーブする。',
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/20-color-and-switch.md',
    'rules/26-qa-deck-refresh.md'
  ]
};

export const B09056: CardDef = {
  id: 'B09056',
  no: '0998/B09056',
  kind: 'character',
  names: [
    '赤井秀一'
  ],
  colors: [
    '赤'
  ],
  level: 8,
  ap: 7000,
  lp: 2,
  traits: [
    'FBI',
    '赤井家'
  ],
  rarity: 'R',
  imageUrl: '1775608872763572.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/20-color-and-switch.md',
    'rules/26-qa-deck-refresh.md'
  ],
};
