// cards/ct-p05/B05090 安室透 (character) — Task A green候補 (engine変更0)
// rules: rules/17-icons.md, rules/20-color-and-switch.md, rules/03-field-areas.md, rules/09-cutin-disguise.md, rules/15-abilities-effects.md, rules/19-special-rules.md, rules/22-qa-action-contact.md
// 公式テキスト:
//   【登場時】手札からレベル4以下の【黄】のキャラを1枚までスリープ状態で登場させる。〚特徴［警察］〛のキャラを登場させた場合、カードを1枚引く。〚特徴［喫茶ポアロ］〛のキャラを登場させた場合、そのキャラをアクティブにする。
//   【カットイン】【パートナー黄】【解決編】AP＋1000、カードを1枚引く。（コンタクト中に手札からリムーブして使う）
// 句マッピング:
//   - 【登場時】 => abilities[0] type:'triggered', scope:'on-scene', trigger:{hook:'enter', selfOnly:true} [hook 'enter' (capability-map §B / hooks ref: 登場時, selfOnly=source.uid match). EXACT exemplar src/cards/ct-d11/D11014.ts a1 trigger{hook:'enter',selfOnly:true}. enter emitted by mutate.scene.enter/switchEnter (src/engine/effect/atom-handlers.ts sceneEnter:585 event.emit 'enter'). rules/17-icons.md 【登場時】]
//   - 手札からレベル4以下の【黄】のキャラを1枚まで…登場させる => step1 choice{chooser:'self'}→atom sceneEnter {from:'hand', cardId:'$pick.cardId', target:{query:{area:'hand',side:'self',filter:{color:'黄',levelMax:4,kind:'character'}},n:{min:0,max:1},chooser:'self'}} [sceneEnter from:'hand' with hand-pick — EXACT exemplar src/cards/ct-p05/B05055.ts a1 (choice→sceneEnter {player:'self',cardId:'$pick.cardId',from:'hand',viaEffect:true,target:{kind:'pick',query:{area:'hand',side:'self',filter:{trait:'鈴木財閥',levelMax:5}},n:{min:0,max:1},chooser:'self'}}). filter color/levelMax/kind all honored on the hand pick path via matchOneFilter (filter ref §TargetFilter: color, levelMin/Max, kind('character'|'event') honored). n:{min:0,max:1}='1枚まで'=0OK (filter ref §pick legalCount clamp). rules/20-color-and-switch.md, rules/15-abilities-effects.md]
//   - スリープ状態で登場させる => sceneEnter args.enterSleep:true [enterSleep:true → mutate.scene.enter with active:false → 'sleep' (src/engine/effect/atom-handlers.ts sceneEnter:551 'active: a.enterSleep === true ? false : undefined'). EXACT exemplar src/cards/ct-d01/D01012.ts a1 sceneEnter args {..., enterSleep:true} ('レベル4以下の【青】のキャラを1枚までスリープ状態で登場'). rules/03-field-areas.md スリープ状態]
//   - 〚特徴［警察］〛のキャラを登場させた場合、カードを1枚引く => step2 conditional{if: boundMatchesFilter{bindKey:'$entered', filter:{trait:'警察'}}, then: atom draw {player:'self',n:1}} [sceneEnter args.bind:'$entered' writes ctx.bindings['$entered']=[{cardId,uid,...}] of the entered char (src/engine/effect/atom-handlers.ts sceneEnter:571-575). boundMatchesFilter honors trait via lookupCardDef(cardId).traits intersection (src/engine/cond/eval.ts:215-219, verified read). EXACT structural exemplar src/cards/ct-d11/D11014.ts a2 (sceneEnter bind:'$entered' → conditional{if:boundMatchesFilter{bindKey:'$entered',filter:{cardName:'萩原千速'}}, then:draw}). draw atom (capability-map Draw §). rules/15-abilities-effects.md, rules/19-special-rules.md (trait honored as printed)]
//   - 〚特徴［喫茶ポアロ］〛のキャラを登場させた場合、そのキャラをアクティブにする => step3 conditional{if: boundMatchesFilter{bindKey:'$entered', filter:{trait:'喫茶ポアロ'}}, then: atom sceneSetState {uid:'$entered.uid', state:'active'}} ['そのキャラ'=the entered char resolved via $entered.uid: resolveBindRef('$entered.uid',ctx) keys 'entered' then falls back to '$entered' binding, returns first['uid']=newChar.uid (src/engine/effect/atom-handlers.ts resolveBindRef:166-176 + sceneEnter bind writeback:571-575). sceneSetState explicit-uid path: resolveBindRef(a.uid) then mutate.scene.setState(s,ssUid,'active') (atom-handlers.ts sceneSetState:701-705, verified read). $matched.uid for an entered char proven in src/cards/ct-d11/D11019.ts a1 (charGrantKeyword uid:'$matched.uid' after sceneEnter); same writeback mechanism populates $entered.uid. Char entered fresh in sleep (not stun) so setState 'active' applies normally (rules/03 stun exception N/A). rules/03-field-areas.md]
//   - 【カットイン】 => abilities[1] type:'triggered', scope:'on-hand', trigger:{hook:'effect:declared', optional:true, selfOnly:true} [Cut-in encoding = triggered + scope:'on-hand' + trigger{hook:'effect:declared',optional:true,selfOnly:true} (capability-map §3 icon-disguise/cutin note; hooks ref ICON ABILITIES Cut-in; detected by read/keyword.ts abilityIsCutin, fired via flow/contact.ts). EXACT exemplar src/cards/ct-d02/D02012.ts a1, src/cards/ct-p05/B05110.ts a2. rules/09-cutin-disguise.md]
//   - 【パートナー黄】【解決編】 => abilities[1].condition and[ partnerColor{color:'黄'}, caseStatus{status:'解決編'} ] [partnerColor (cond ref §partnerColor: owner partner colors intersect) — exemplar src/cards/ct-p05/B05010.ts a1 condition{kind:'partnerColor',color:'青'}. caseStatus 解決編 (cond ref §caseStatus) — EXACT exemplar src/cards/ct-p05/B05110.ts a2 condition{kind:'caseStatus',status:'解決編'}. 'and' combinator (cond ref §and, cs:[].every). Both icon-conditions must hold; if unmet the cut-in is usable-but-no-effect (rules/17 §条件を満たしていない場合 = ability.condition false → effect not queued, card still discarded via contact flow). rules/17-icons.md]
//   - AP＋1000、カードを1枚引く => abilities[1].effect sequence[ atom charModifyAP {uid:'$contact.byUid', delta:1000, scope:'contact'}, atom draw {player:'self',n:1} ] [Cut-in AP+ on the contact attacker via $contact.byUid (dyn ref §$contact.byUid=attacker uid; charModifyAP scope:'contact' expires at contact end per rules/09). EXACT exemplar src/cards/ct-p05/B05010.ts a1 / B05036.ts a1 (sequence[charModifyAP{uid:'$contact.byUid',delta:1000,scope:'contact'}, ...draw]). draw {player:'self',n:1} (capability-map Draw §). Both effects unconditional once the cut-in fires (no inner 'した場合' gate in this text). rules/09-cutin-disguise.md, rules/22-qa-action-contact.md]

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
    kind: 'sequence',
    steps: [
      {
        kind: 'choice',
        chooser: 'self',
        options: [
          {
            kind: 'atom',
            verb: 'sceneEnter',
            args: {
              player: 'self',
              cardId: '$pick.cardId',
              from: 'hand',
              viaEffect: true,
              enterSleep: true,
              bind: '$entered',
              target: {
                kind: 'pick',
                query: {
                  area: 'hand',
                  side: 'self',
                  filter: {
                    color: '黄',
                    levelMax: 4,
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
      },
      {
        kind: 'conditional',
        if: {
          kind: 'boundMatchesFilter',
          bindKey: '$entered',
          filter: {
            trait: '警察'
          }
        },
        then: {
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
          kind: 'boundMatchesFilter',
          bindKey: '$entered',
          filter: {
            trait: '喫茶ポアロ'
          }
        },
        then: {
          kind: 'atom',
          verb: 'sceneSetState',
          args: {
            uid: '$entered.uid',
            state: 'active'
          }
        }
      }
    ]
  },
  description: '【登場時】手札からレベル4以下の【黄】のキャラを1枚までスリープ状態で登場させる。〚特徴［警察］〛のキャラを登場させた場合、カードを1枚引く。〚特徴［喫茶ポアロ］〛のキャラを登場させた場合、そのキャラをアクティブにする。',
  ruleRefs: [
    'rules/17-icons.md',
    'rules/20-color-and-switch.md',
    'rules/03-field-areas.md',
    'rules/19-special-rules.md',
    'rules/15-abilities-effects.md'
  ]
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-hand',
  trigger: {
    hook: 'effect:declared',
    optional: true,
    selfOnly: true
  },
  condition: {
    kind: 'and',
    cs: [
      {
        kind: 'partnerColor',
        color: '黄'
      },
      {
        kind: 'caseStatus',
        status: '解決編'
      }
    ]
  },
  effect: {
    kind: 'sequence',
    steps: [
      {
        kind: 'atom',
        verb: 'charModifyAP',
        args: {
          uid: '$contact.byUid',
          delta: 1000,
          scope: 'contact'
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
  },
  description: '【カットイン】【パートナー黄】【解決編】AP＋1000、カードを1枚引く。',
  ruleRefs: [
    'rules/09-cutin-disguise.md',
    'rules/17-icons.md',
    'rules/22-qa-action-contact.md'
  ]
};

export const B05090: CardDef = {
  id: 'B05090',
  no: '0588/B05090',
  kind: 'character',
  names: [
    '安室透'
  ],
  colors: [
    '黄'
  ],
  level: 6,
  ap: 5000,
  lp: 1,
  traits: [
    '探偵',
    '喫茶ポアロ'
  ],
  rarity: 'R',
  imageUrl: '1745322226177831.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/17-icons.md',
    'rules/20-color-and-switch.md',
    'rules/03-field-areas.md',
    'rules/09-cutin-disguise.md',
    'rules/15-abilities-effects.md',
    'rules/19-special-rules.md',
    'rules/22-qa-action-contact.md'
  ],
};
