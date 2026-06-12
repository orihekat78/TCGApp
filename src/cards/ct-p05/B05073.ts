// cards/ct-p05/B05073 大橋彩代 (character) — Task A green候補 (engine変更0)
// rules: rules/13-keywords.md, rules/21-declared-ability-cost.md, rules/17-icons.md, rules/15-abilities-effects.md, rules/20-color-and-switch.md, rules/19-special-rules.md
// 公式テキスト:
//   〚ミスリード1〛（相手の推理に対し、スリープさせることでLP－1する）\n【宣言】【ターン1】このキャラ以外の【青】か【赤】のキャラを1枚まで選び、ターン終了時までAP＋1000する。
// 句マッピング:
//   - 〚ミスリード1〛 => abilities[0] __shared misreadX({x:1}) → type:'icon-misread' [src/cards/_shared/misreadX.ts (icon-misread, args.x read by src/engine/listeners/misread.ts on reasoning:before-add: sleeps the misread char + applies LP-X to the reasoning char); identical usage in src/cards/ct-d03/D03010.ts a1, src/cards/ct-p06/B06093.ts a1. __shared:'misreadX' is whitelisted in scripts/taskA-codegen.cjs SHARED_FNS + taskA-validate-specs.cjs SHARED_FNS. rules/13-keywords.md §ミスリードX. NOT a top-level CardDef keyword → keywords:[]]
//   - 【宣言】 => abilities[1] type:'declared' [AbilityType 'declared' (capability-map §3); exemplar src/cards/ct-p04/B04005.ts a2 (also 【宣言】 with no cost). rules/21-declared-ability-cost.md (no ':' in text → no cost)]
//   - 【ターン1】 => abilities[1].limit { kind:'turn', n:1 } [limit:{kind:'turn',n:1} enforced via declaredUseCount per uid+abilityId (hooks ref §How a triggered ability fires / declared §); exemplar B04005.ts a2 limit:{kind:'turn',n:1}; B09088.ts a1, B03100.ts a1 same. rules/17-icons.md 【ターン①】]
//   - このキャラ以外の => target.query.excludeSelf: true [TargetQuery.excludeSelf (filter ref §TargetQuery: scene-only, drops candidate whose uid===ctx.source.uid). EXACT exemplar src/cards/ct-p04/B04005.ts a2 query {area:'scene',side:'either',filter:{trait:...},excludeSelf:true}. NOTE: short-form charModifyAP (B09088 a1) does NOT pass excludeSelf — src/engine/effect/atom-pick-spec.ts buildShortFormPick only forwards filter/filterAny/state/distinctNames; so the full-pick target form (Pattern A: uid:'$pick' + target) is required, confirmed honored in src/engine/effect/resolve-picks.ts (isPatternA = args.uid==='$pick' → enumerate via targetCandidates(target), substitute uid, drop target)]
//   - 【青】か【赤】のキャラ => target.query.filter { color: ['青','赤'] } [TargetFilter.color = string|string[] = OR-membership; 2 listed colors means 'has 青 OR 赤' (cond ref §caseColor/filter ref §color: 'No has-ALL mode; membership-OR only'). Color-array exemplars: src/cards/ct-p09/B09088.ts a1 charModifyAP filter:{color:['青','黄']}; src/cards/ct-p09/B09044.ts filter:{color:['青','白'],...}. rules/20-color-and-switch.md]
//   - を1枚まで選び => target.n {min:0,max:1}, chooser:'self' (player pick, 0-allowed) [filter ref §TargetingRef pick: legalCount clamps min/max so '〜枚まで' allows 0 when fewer exist; n:{min:0,max:1}=0〜1. EXACT exemplar B04005.ts a2 n:{min:0,max:1},chooser:'self'. rules/15-abilities-effects.md '〜枚まで'=0枚可]
//   - ターン終了時までAP＋1000する => atom charModifyAP { uid:'$pick', delta:1000, scope:'turn' } [charModifyAP (capability-map Char modify §; Pattern A verb). delta:1000 + scope:'turn' (turn-scoped AP mod, expires at turn end). EXACT exemplar src/cards/ct-p04/B04005.ts a2 {uid:'$pick',delta:1000,scope:'turn',target:{...}}; also B09088.ts a1 (short-form), B03100.ts a1. rules/19-special-rules.md (AP modifier, no lower bound)]

import type { AbilityDef, CardDef } from '@/engine/types';
import { misreadX } from '@/cards/_shared';

const a1 = misreadX({
  x: 1,
  abilityId: 'a1'
});

const a2: AbilityDef = {
  id: 'a2',
  type: 'declared',
  scope: 'on-scene',
  limit: {
    kind: 'turn',
    n: 1
  },
  effect: {
    kind: 'choice',
    chooser: 'self',
    options: [
      {
        kind: 'atom',
        verb: 'charModifyAP',
        args: {
          uid: '$pick',
          delta: 1000,
          scope: 'turn',
          target: {
            kind: 'pick',
            query: {
              area: 'scene',
              side: 'either',
              filter: {
                color: [
                  '青',
                  '赤'
                ]
              },
              excludeSelf: true
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
  description: '【宣言】【ターン1】このキャラ以外の【青】か【赤】のキャラを1枚まで選び、ターン終了時までAP＋1000する。',
  ruleRefs: [
    'rules/21-declared-ability-cost.md',
    'rules/17-icons.md',
    'rules/15-abilities-effects.md',
    'rules/20-color-and-switch.md'
  ]
};

export const B05073: CardDef = {
  id: 'B05073',
  no: '0573/B05073',
  kind: 'character',
  names: [
    '大橋彩代'
  ],
  colors: [
    '赤'
  ],
  level: 4,
  ap: 4000,
  lp: 1,
  traits: [
    'ラーメン小倉'
  ],
  rarity: 'C',
  imageUrl: '1745322226140522.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/13-keywords.md',
    'rules/21-declared-ability-cost.md',
    'rules/17-icons.md',
    'rules/15-abilities-effects.md',
    'rules/20-color-and-switch.md',
    'rules/19-special-rules.md'
  ],
};
