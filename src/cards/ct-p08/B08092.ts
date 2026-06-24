// cards/ct-p08/B08092 出来損ないの名探偵 (event) — Task A green候補 (engine変更0)
// rules: rules/15-abilities-effects.md, rules/17-icons.md, rules/20-color-and-switch.md, rules/03-field-areas.md, rules/19-special-rules.md
// 公式テキスト:
//   【事件青＆黒】カードを1枚引く。手札から【現場リムーブ時】を持つレベル4以下のキャラを1枚までスリープ状態で登場させる。自分の現場に〚カード名［シェリー］〛か〚［灰原哀］〛がいる場合、レベル7以下のキャラを1枚まで選び、リムーブする。
// 句マッピング:
//   - 【事件青＆黒】 (event-wide condition icon) => ability.condition = {kind 'caseColor', color:['青','黒'], combine:'and'} [src/engine/cond/eval.ts:45-57 caseColor honors combine:'and' via want.every(c=>have.includes(c)); exemplar src/cards/ct-p08/B08085.ts a1 uses {kind 'caseColor', color:['青','黒'], combine:'and'} for the identical 【事件青＆黒】 icon. rules/17: 条件未充足なら能力を持たない扱い (= 何も起こらないイベント).]
//   - event self-use trigger (このイベントを使用したとき本体効果が解決) => scope 'on-hand', trigger {hook 'effect:declared', selfOnly:true, __eventUse:true} [src/cards/ct-p02/B02083.ts a1 (kind 'event') is the canonical event self-use template (scope 'on-hand', trigger hook effect:declared selfOnly:true matcher p.kind==='event-use'). scripts/taskA-codegen.cjs:112-121 expands the __eventUse:true pseudo-flag into the matcher closure → abilities JSON stays pure JSON. listeners/triggered.ts emits effect:declared {kind 'event-use',cardId} on event use.]
//   - カードを1枚引く => atom draw {player:'self', n:1} [ATOM_VERB_MAP includes draw (validate.ts). Used identically in B02083.ts forEach do:draw and dozens of cards; n literal honored at atom-handlers draw.]
//   - 手札から【現場リムーブ時】を持つレベル4以下のキャラを1枚までスリープ状態で登場させる => atom sceneEnter {player:'self', from:'hand', max:1, viaEffect:true, enterSleep:true, filter:{kind 'character', keyword:'現場リムーブ時', levelMax:4}} [from:'hand' max:1 viaEffect:true filter shape = src/cards/ct-p05/B05112.ts a1 (sceneEnter from hand, filter:{kind 'character', keyword:'カットイン', levelMax:5}). enterSleep:true (スリープ状態で登場) = src/cards/pr-01/PR086.ts:51 (sceneEnter from:'hand', enterSleep:true, filter levelMax/trait) and src/cards/ct-d01/D01012.ts:41; atom-handlers/scene.ts:43,176-178 active=a.enterSleep===true?false:undefined → mutate.scene sleep state (rules/03). keyword:'現場リムーブ時' presence filter is HONORED: src/engine/read/keyword.ts abilityIsSceneRemoveTrigger (type 'triggered' + trigger.selfOnly===true + hooks include 'leave:to-remove') registered in ICON_KEYWORD_PREDICATES['現場リムーブ時']; src/engine/target/candidates.ts:294-299 filter.keyword → defHasKeyword(d,w). (Brief STILL-OPEN 'hook presence filter' entry is STALE for this hook — BUG-122/cluster2 enabled 現場リムーブ時 & 疾風; live keyword.ts + B09104.ts a1 use filter:{keyword:'現場リムーブ時'} in production.) levelMax in TargetFilter (effect/types). 「1枚まで」=max:1 (0枚可, rules/15). 効果による登場なので色制限なし (rules/20).]
//   - 自分の現場に〚カード名［シェリー］〛か〚［灰原哀］〛がいる場合 => conditional.if = {kind 'bond', cardName:['シェリー','灰原哀']} [src/engine/cond/eval.ts:79-90 bond: wants=Array.isArray(cond.cardName)?cond.cardName:[cond.cardName]; scans owner.scene; allCardNameComponentsForDef honors split-names (rules/19); returns true if ANY listed name present (= 「か」OR). bond array exemplars src/cards/ct-p06/B06070.ts/B01091.ts use array form. rules/17: 【絆】はパートナーでは満たさない (scene only) — matches 「自分の現場に…いる場合」.]
//   - レベル7以下のキャラを1枚まで選び、リムーブする => conditional.then = atom sceneRemove {player:'self', max:1, side:'either', cause:'effect', filter:{levelMax:7}} [src/cards/ct-p07/B07019.ts a1 then-branch uses sceneRemove {player:'self', max:1, side:'either', cause:'effect', filter:{levelMax:7}} for the identical 「レベル7以下のキャラを1枚まで選び、リムーブする」. side:'either' = エリア指定なし「キャラ」両現場 (rules/15); max:1 = 「1枚まで」0枚可; cause:'effect' (能力/効果リムーブ, not contact). sceneRemove in ATOM_VERB_MAP.]

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-hand',
  condition: {
    kind: 'caseColor',
    color: [
      '青',
      '黒'
    ],
    combine: 'and'
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
        verb: 'draw',
        args: {
          player: 'self',
          n: 1
        }
      },
      {
        kind: 'atom',
        verb: 'sceneEnter',
        args: {
          player: 'self',
          from: 'hand',
          max: 1,
          viaEffect: true,
          enterSleep: true,
          filter: {
            kind: 'character',
            keyword: '現場リムーブ時',
            levelMax: 4
          }
        }
      },
      {
        kind: 'conditional',
        if: {
          kind: 'bond',
          cardName: [
            'シェリー',
            '灰原哀'
          ]
        },
        then: {
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
        }
      }
    ]
  },
  description: '【事件青＆黒】カードを1枚引く。手札から【現場リムーブ時】を持つレベル4以下のキャラを1枚までスリープ状態で登場させる。自分の現場に〚カード名［シェリー］〛か〚［灰原哀］〛がいる場合、レベル7以下のキャラを1枚まで選び、リムーブする。',
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/20-color-and-switch.md',
    'rules/03-field-areas.md',
    'rules/19-special-rules.md'
  ]
};

export const B08092: CardDef = {
  id: 'B08092',
  no: '0928/B08092',
  kind: 'event',
  names: [
    '出来損ないの名探偵'
  ],
  colors: [
    '黒'
  ],
  level: 7,
  traits: [],
  rarity: 'C',
  imageUrl: '1770731270551433.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/20-color-and-switch.md',
    'rules/03-field-areas.md',
    'rules/19-special-rules.md'
  ],
};
