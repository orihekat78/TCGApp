// cards/ct-p07/B07082 高木渉 (character) — Task A green候補 (engine変更0)
// rules: rules/10-action-event.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/19-special-rules.md, rules/03-field-areas.md
// 公式テキスト:
//   【登場時】自分の現場にこのキャラ以外のレベル7以上の〚特徴［警視庁］〛のキャラがいる場合、自分のリムーブエリアにあるレベル5以下の〚カード名［佐藤美和子］〛を1枚まで選び、スリープ状態で登場させる。
//   【ヒラメキ】キャラを1枚まで選び、スリープさせる。
// 句マッピング:
//   - 【登場時】 => triggered, scope:'on-scene', trigger:{hook:'enter', selfOnly:true} [enter hook (登場時) per capability-map.txt L286-287 (payload {uid,viaEffect,enterOrder,enterOrderThisTurn}, selfOnly ✅ via source.uid); exemplar src/cards/ct-d08/D08019.ts a1 and src/cards/ct-p06/B06052.ts a1 use exact {hook:'enter',selfOnly:true}]
//   - 自分の現場にこのキャラ以外のレベル7以上の〚特徴［警視庁］〛のキャラがいる場合 => conditional.if = sceneHas{query:{area:'scene',side:'self',filter:{trait:'警視庁',levelMin:7},excludeSelf:true},nMin:1} [sceneHas honored in cond/eval.ts (capability-map.txt L153,566 — full TargetQuery power incl excludeSelf). excludeSelf honored in src/engine/target/candidates.ts:184 (cand.uid===ctx.source.uid → false). trait honored candidates.ts:247-250; levelMin honored candidates.ts:293 (effective level = printed+mods). Exemplar src/cards/ct-d08/D08011.ts a1 if = sceneHas{query:{area:'scene',side:'self',filter:{trait:...},excludeSelf:true},nMin:1}; src/cards/ct-d08/D08019.ts a1 wraps reanimate in conditional.if sceneHas]
//   - 自分のリムーブエリアにあるレベル5以下の〚カード名［佐藤美和子］〛を1枚まで選び、スリープ状態で登場させる => atom sceneEnter {player:'self',from:'remove',max:1,viaEffect:true,enterSleep:true,filter:{cardName:'佐藤美和子',levelMax:5,kind:'character'}} [sceneEnter from:'remove' uses buildShortFormPick(a.from,...) per atom-handlers.ts:475 (sourceArea remove splice L528-530) and atom-pick-spec.ts:46 (sceneEnter defaultArea:'from',mode:'PA',sourceSplice:true) — passes args.filter through (atom-pick-spec.ts:74,78); max:1 → n:{min:0,max:1} (1枚まで, skip-OK). cardName honored matchOneFilter candidates.ts:240-245 (split-name); levelMax candidates.ts:294; kind candidates.ts:273. enterSleep (スリープ状態で登場) confirmed in sceneEnter args (capability-map.txt L33,552). Exemplar src/cards/ct-p06/B06052.ts a1 = sceneEnter{from:'remove',max:1,viaEffect:true,enterSleep:true,filter:{trait:'YAIBA',levelMax:6,kind:'character'}} — identical shape, only filter trait→cardName]
//   - 【ヒラメキ】 => triggered, scope:'on-evidence', trigger:{hook:'evidence:remove-by-action',optional:true} [evidence:remove-by-action hook (ヒラメキ) per capability-map.txt L325 (scope must allow on-evidence, selfOnly not evaluated, optional → pendingHirameki fire/skip). Exemplar src/cards/ct-d08/D08019.ts a2 uses exact {hook:'evidence:remove-by-action',optional:true} scope:'on-evidence']
//   - キャラを1枚まで選び、スリープさせる => choice{chooser:'self',options:[atom sceneSetState {uid:'$pick',state:'sleep',target:{kind:'pick',query:{area:'scene',side:'either'},n:{min:0,max:1},chooser:'self'}}]} [sceneSetState state:'sleep' with $pick + explicit pick query (n min0/max1 = 1枚まで, side:'either' = どちらの現場でも). VERBATIM-identical official text to exemplar src/cards/ct-d08/D08019.ts a2 — copied exact shape incl the documented requirement that hirameki fire needs explicit target ($pick + pick query) so hiramekiResolve auto-resolves the pick. sceneSetState honored capability-map.txt L38; candidates side:'either' picks both scenes]

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
    kind: 'conditional',
    if: {
      kind: 'sceneHas',
      query: {
        area: 'scene',
        side: 'self',
        filter: {
          trait: '警視庁',
          levelMin: 7
        },
        excludeSelf: true
      },
      nMin: 1
    },
    then: {
      kind: 'atom',
      verb: 'sceneEnter',
      args: {
        player: 'self',
        from: 'remove',
        max: 1,
        viaEffect: true,
        enterSleep: true,
        filter: {
          cardName: '佐藤美和子',
          levelMax: 5,
          kind: 'character'
        }
      }
    }
  },
  description: '【登場時】自分の現場にこのキャラ以外のレベル7以上の〚特徴［警視庁］〛のキャラがいる場合、自分のリムーブエリアにあるレベル5以下の〚カード名［佐藤美和子］〛を1枚まで選び、スリープ状態で登場させる。',
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/19-special-rules.md',
    'rules/03-field-areas.md'
  ]
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-evidence',
  trigger: {
    hook: 'evidence:remove-by-action',
    optional: true
  },
  effect: {
    kind: 'choice',
    chooser: 'self',
    options: [
      {
        kind: 'atom',
        verb: 'sceneSetState',
        args: {
          uid: '$pick',
          state: 'sleep',
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
    ]
  },
  description: '【ヒラメキ】キャラを1枚まで選び、スリープさせる。',
  ruleRefs: [
    'rules/10-action-event.md',
    'rules/03-field-areas.md'
  ]
};

export const B07082: CardDef = {
  id: 'B07082',
  no: '0810/B07082',
  kind: 'character',
  names: [
    '高木渉'
  ],
  colors: [
    '黄'
  ],
  level: 7,
  ap: 6000,
  lp: 1,
  traits: [
    '警察',
    '警視庁'
  ],
  rarity: 'R',
  imageUrl: '1762414027352093.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/10-action-event.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/19-special-rules.md',
    'rules/03-field-areas.md'
  ],
};
