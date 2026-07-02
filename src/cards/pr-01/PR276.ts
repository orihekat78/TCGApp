// cards/pr-01/PR276 萩原千速 (character) — Task A green候補 (engine変更0)
// rules: rules/07-action-flow.md, rules/13-keywords.md, rules/14-refresh.md, rules/15-abilities-effects.md, rules/17-icons.md
// 公式テキスト:
//   【パートナー黄】〚突撃〛（名乗り状態でもアクションできる）\nこのキャラがアクションしたとき、自分のデッキのカードを上から2枚リムーブしてもよい。そうした場合、アクション終了時までこのキャラをAP＋1000する。
// 句マッピング:
//   - 【パートナー黄】 => partnerColorKeyword shared helper → continuous ability with condition {kind:'partnerColor', color:'黄'} [Condition partnerColor (cond/eval.ts; capability-map.txt 'Case/partner color' §) honored. Shared helper src/cards/_shared/partnerColorKeyword.ts builds {type:'continuous', condition:{kind:'partnerColor',color}}. Codegen supports {__shared:'partnerColorKeyword'} (scripts/taskA-codegen.cjs SHARED_FNS line 108).]
//   - 〚突撃〛（名乗り状態でもアクションできる） => partnerColorKeyword args kw:'突撃' → continuousModifier.grantKeywords:['突撃'] (granted, conditional) [continuous grantKeywords keyword grant exemplar src/cards/ct-d08/D08021.ts a2 (grantKeywords:()=>['突撃'] under condition). partnerColorKeyword helper (src/cards/_shared/partnerColorKeyword.ts line 30-32) emits grantKeywords:()=>[opts.kw]. Capability-map §3 continuous = owner-only keyword grant on bearer (this card) — correct for 'このキャラ'. 突撃 is GRANTED (conditional on partner colour), not innate → keywords:[] at top level.]
//   - このキャラがアクションしたとき => trigger {hook:'action:declare', selfOnly:true}, scope:'on-scene' [Hook action:declare registered + emitted (capability-map §B; listeners/triggered.ts; emit flow/action/state-machine.ts). selfOnly matches attacker source.uid. Exact exemplar src/cards/ct-d02/D02004.ts a1 + src/cards/ct-d08/D08021.ts a3 ('このキャラがアクションしたとき' = trigger{hook:'action:declare',selfOnly:true}).]
//   - 自分のデッキのカードを上から2枚リムーブしてもよい => {kind:'optional', effect:{chain:[ atom mill {player:'self', n:2, gate:true}, ... ]}} [BUG-162 修正: 「そうした場合」= gated chain。mill gate:true (atom-handlers mill gate 分岐、wave-deck-mill-gated-chain 2026-06-23) で deck<2 なら chain break → 後続の AP+1000 不成立。公式Q&A「デッキ1枚で全リムーブしてAP+1000できるか→いいえ」。同一カード src/cards/ct-p03/B03094.ts a2 と一致。NOTE: AI/CPU always skips optional。]
//   - そうした場合、アクション終了時までこのキャラをAP＋1000する => chain 第2 step: atom charModifyAP {uid:'$self', delta:1000, scope:'action'} [BUG-162 修正: 「アクション終了時まで」= scope:'action' (mutate/char.ts ModScope 'action'、apMod_action、state-machine action-end + turn-end net で清掃)。旧 scope:'turn' はターン終了まで残り誤り (rules/22: 「アクション終了時まで」と「ターン終了時まで」は別 scope)。以前の precedent 主張 ct-d02/D02004.ts a1 も同じ scope:'turn' bug を持っていた → 本 commit で同時修正。]

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
      // BUG-162: 「2枚リムーブしてもよい。そうした場合〜」= optional + gated chain。
      // deck<2 で mill gate:true が chain を break → AP+1000 不成立 (公式Q&A「デッキ1枚で全リムーブしてAP+1000できるか→いいえ」)。
      // charModifyAP scope:'action' = 「アクション終了時まで」(rules/22: action-end で失効、turn とは別 scope)。
      // ct-p03/B03094 (同一カード 萩原千速、Q&A grounded 出荷済) の a2 と完全一致させる。
      kind: 'chain',
      steps: [
        {
          kind: 'atom',
          verb: 'mill',
          args: {
            player: 'self',
            n: 2,
            gate: true
          }
        },
        {
          kind: 'atom',
          verb: 'charModifyAP',
          args: {
            uid: '$self',
            delta: 1000,
            scope: 'action'
          }
        }
      ]
    }
  },
  description: 'このキャラがアクションしたとき、自分のデッキのカードを上から2枚リムーブしてもよい。そうした場合、アクション終了時までこのキャラをAP＋1000する。',
  ruleRefs: [
    'rules/07-action-flow.md',
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/22-qa-action-contact.md',
    'rules/26-qa-deck-refresh.md'
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
