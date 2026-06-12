// cards/pr-01/PR276 萩原千速 (character) — Task A green候補 (engine変更0)
// rules: rules/07-action-flow.md, rules/13-keywords.md, rules/14-refresh.md, rules/15-abilities-effects.md, rules/17-icons.md
// 公式テキスト:
//   【パートナー黄】〚突撃〛（名乗り状態でもアクションできる）\nこのキャラがアクションしたとき、自分のデッキのカードを上から2枚リムーブしてもよい。そうした場合、アクション終了時までこのキャラをAP＋1000する。
// 句マッピング:
//   - 【パートナー黄】 => partnerColorKeyword shared helper → continuous ability with condition {kind:'partnerColor', color:'黄'} [Condition partnerColor (cond/eval.ts; capability-map.txt 'Case/partner color' §) honored. Shared helper src/cards/_shared/partnerColorKeyword.ts builds {type:'continuous', condition:{kind:'partnerColor',color}}. Codegen supports {__shared:'partnerColorKeyword'} (scripts/taskA-codegen.cjs SHARED_FNS line 108).]
//   - 〚突撃〛（名乗り状態でもアクションできる） => partnerColorKeyword args kw:'突撃' → continuousModifier.grantKeywords:['突撃'] (granted, conditional) [continuous grantKeywords keyword grant exemplar src/cards/ct-d08/D08021.ts a2 (grantKeywords:()=>['突撃'] under condition). partnerColorKeyword helper (src/cards/_shared/partnerColorKeyword.ts line 30-32) emits grantKeywords:()=>[opts.kw]. Capability-map §3 continuous = owner-only keyword grant on bearer (this card) — correct for 'このキャラ'. 突撃 is GRANTED (conditional on partner colour), not innate → keywords:[] at top level.]
//   - このキャラがアクションしたとき => trigger {hook:'action:declare', selfOnly:true}, scope:'on-scene' [Hook action:declare registered + emitted (capability-map §B; listeners/triggered.ts; emit flow/action/state-machine.ts). selfOnly matches attacker source.uid. Exact exemplar src/cards/ct-d02/D02004.ts a1 + src/cards/ct-d08/D08021.ts a3 ('このキャラがアクションしたとき' = trigger{hook:'action:declare',selfOnly:true}).]
//   - 自分のデッキのカードを上から2枚リムーブしてもよい => {kind:'optional', effect:{sequence:[ atom mill {player:'self', n:2}, ... ]}} [atom mill {player,n} = mutate.deck.removeFromTop (atom-handlers.ts case 'mill' line 307-313; capability-map §D). optional wrapper exemplar src/cards/ct-p03/B03038.ts a1 ('…してもよい。そうした場合…' = {kind:'optional', effect:{kind:'sequence',...}}). NOTE: AI/CPU always skips optional (capability-map §wrappers optional; known accepted behavior, not a blocker).]
//   - そうした場合、アクション終了時までこのキャラをAP＋1000する => second sequence step under same optional: atom charModifyAP {uid:'$self', delta:1000, scope:'turn'} [atom charModifyAP {uid:'$self',delta,scope} accumulates via mutate.char.modifyAP (atom-handlers.ts; capability-map §D). EXACT green-certified precedent src/cards/ct-d02/D02004.ts a1 maps the IDENTICAL phrase 'アクション終了時までこのキャラをAP＋1000する' to charModifyAP {uid:'$self',delta:1000,scope:'turn'}. 'そうした場合' is captured by co-membership in the single optional opt-in (both steps run iff player opts in), modeled on B03038 optional+sequence.]

import type { AbilityDef, CardDef } from '@/engine/types';
import { partnerColorKeyword } from '@/cards/_shared';

const a1 = partnerColorKeyword({
  color: '黄',
  kw: '突撃',
  abilityId: 'a1'
});

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-scene',
  trigger: {
    hook: 'action:declare',
    selfOnly: true
  },
  effect: {
    kind: 'optional',
    effect: {
      kind: 'sequence',
      steps: [
        {
          kind: 'atom',
          verb: 'mill',
          args: {
            player: 'self',
            n: 2
          }
        },
        {
          kind: 'atom',
          verb: 'charModifyAP',
          args: {
            uid: '$self',
            delta: 1000,
            scope: 'turn'
          }
        }
      ]
    }
  },
  description: 'このキャラがアクションしたとき、自分のデッキのカードを上から2枚リムーブしてもよい。そうした場合、アクション終了時までこのキャラをAP＋1000する。',
  ruleRefs: [
    'rules/07-action-flow.md',
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md'
  ]
};

export const PR276: CardDef = {
  id: 'PR276',
  no: '0347/PR276',
  kind: 'character',
  names: [
    '萩原千速'
  ],
  colors: [
    '黄'
  ],
  level: 7,
  ap: 5000,
  lp: 1,
  traits: [
    '警察',
    '神奈川県警'
  ],
  rarity: 'PR',
  imageUrl: '1776325107228258.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/07-action-flow.md',
    'rules/13-keywords.md',
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md'
  ],
};
