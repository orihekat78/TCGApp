// cards/ct-p08/B08090 ベルモット (character) — Task A green候補 (engine変更0)
// rules: rules/09-cutin-disguise.md, rules/13-keywords.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/20-color-and-switch.md
// 公式テキスト:
//   【登場時】自分の現場に【黒】以外の色を持つキャラがいる場合、ターン終了時までこのキャラは〚突撃〛（登場したターンからすぐにアクションできる）を持つ。
//   【変装】【FILE5】（コンタクト中のキャラと入れ替わって手札から出る。入れ替わったキャラはデッキの下に移す）
// 句マッピング:
//   - 【登場時】 => type:'triggered', scope:'on-scene', trigger:{hook:'enter', selfOnly:true} [enter hook = 【登場時】 (capability-map hooks §enter, selfOnly via source.uid). EXACT exemplar src/cards/ct-d06/D06006.ts a1 (trigger:{hook:'enter',selfOnly:true}) and src/cards/ct-d08/D08011.ts a1 — both identical 【登場時】 self-grant cards.]
//   - 自分の現場に【黒】以外の色を持つキャラがいる場合 => conditional.if = sceneHas{query:{area:'scene', side:'self', filter:{color:['青','赤','黄','緑','白']}}, nMin:1} [「【黒】以外の色を持つ」expressed as the complement of the 6-color set (青赤黄緑白黒 per src/cards/_shared/caseMonoColor.ts ALL_COLORS) minus 黒. filter.color is OR-membership (src/engine/target/candidates.ts:253-256 `wants.some(w=>colors.includes(w))`), so it matches any char having at least one non-black color — incl. 黒/X dual cards (correct: they DO have a non-black color) and excludes pure-黒 chars. Complement-enumeration technique grounded in caseMonoColor.ts (not(caseColor[others])). Color-array scene filter grounded in src/cards/ct-p05/B05073.ts a2 (filter:{color:['青','赤']}) and src/cards/ct-p09/B09088.ts a1 (charModifyAP filter:{color:['青','黄']}). sceneHas+scene color filter grounded in src/cards/ct-d06/D06006.ts a1 (sceneHas{filter:{color:'白'}}, nMin:1). Condition gate-at-fire grounded in src/cards/ct-d08/D08021.ts a3.]
//   - ターン終了時までこのキャラは〚突撃〛（登場したターンからすぐにアクションできる）を持つ => conditional.then = atom charGrantKeyword{uid:'$self', kw:'突撃', scope:'turn'} [charGrantKeyword self-grant, turn-scoped. EXACT exemplar src/cards/ct-d06/D06006.ts a1 then:{atom charGrantKeyword {uid:'$self', kw:'突撃', scope:'turn'}} (same 突撃 grant). Also src/cards/ct-d08/D08011.ts a1, src/cards/ct-p02/B02074.ts. charGrantKeyword verb confirmed in capability-map Char modify § (mutate.char.grantKeyword, scope='turn'). 突撃 here is GRANTED-by-effect, not an innate printed keyword → keywords:[].]
//   - 【変装】【FILE5】（コンタクト中のキャラと入れ替わって手札から出る。入れ替わったキャラはデッキの下に移す） => type:'icon-disguise', condition:{kind:'fileAtLeast', n:5} [icon-disguise AbilityType = 変装 capability gate; condition = disguise-gate predicate evaluated by canDisguise (capability-map §3 icon-disguise; hooks ICON ABILITIES Disguise). 【FILE5】 = fileAtLeast{n:5} (capability-map Conditions §fileAtLeast, assisted-partner counted). EXACT exemplar src/cards/ct-p03/B03129.ts a1 ({type:'icon-disguise', condition:{kind:'fileAtLeast', n:6}, description:'【変装】【FILE6】（コンタクト中のキャラと入れ替わって…）') — byte-for-byte same shape, only n differs. Also src/cards/ct-d06/D06012.ts a1 (and[caseColor, fileAtLeast]). No 【変装時】 sub-effect on this card (henso text has no extra clause) → no disguise:into ability needed.]

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
          color: [
            '青',
            '赤',
            '黄',
            '緑',
            '白'
          ]
        }
      },
      nMin: 1
    },
    then: {
      kind: 'atom',
      verb: 'charGrantKeyword',
      args: {
        uid: '$self',
        kw: '突撃',
        scope: 'turn'
      }
    }
  },
  description: '【登場時】自分の現場に【黒】以外の色を持つキャラがいる場合、ターン終了時までこのキャラは〚突撃〛（登場したターンからすぐにアクションできる）を持つ。',
  ruleRefs: [
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/20-color-and-switch.md'
  ]
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'icon-disguise',
  condition: {
    kind: 'fileAtLeast',
    n: 5
  },
  description: '【変装】【FILE5】（コンタクト中のキャラと入れ替わって手札から出る。入れ替わったキャラはデッキの下に移す）',
  ruleRefs: [
    'rules/09-cutin-disguise.md',
    'rules/17-icons.md'
  ]
};

export const B08090: CardDef = {
  id: 'B08090',
  no: '0926/B08090',
  kind: 'character',
  names: [
    'ベルモット'
  ],
  colors: [
    '黒'
  ],
  level: 6,
  ap: 5000,
  lp: 1,
  traits: [
    '黒ずくめの組織'
  ],
  rarity: 'C',
  imageUrl: '1770731270520978.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/09-cutin-disguise.md',
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/20-color-and-switch.md'
  ],
};
