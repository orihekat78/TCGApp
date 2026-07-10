// cards/ct-p08/B08086 テキーラ (character) — card-authoring wave17 ($self.oppSceneCount aura + D11013型cutin, engine変更0, 2026-07-03)
// rules: 09-cutin-disguise.md, 15-abilities-effects.md, 17-icons.md, 22-qa-action-contact.md
//
// 公式テキスト:
//   【パートナー黒】【自分ターン中】相手の現場にいるキャラ1枚につき、このキャラをAP＋2000する。
//   【カットイン】【自分ターン中】【黒】のキャラに【カットイン】する場合、AP＋2000
//     （自分のターンのコンタクト中に手札からリムーブして使う）
//
// a1: 継続 AP aura。【パートナー黒】+【自分ターン中】= condition and[partnerColor黒, turn self]。
//     「相手の現場のキャラ1枚につき AP+2000」= continuousModifier apDelta {dyn:'$self.oppSceneCount * 2000'}
//     ($self.oppSceneCount dyn = 相手現場キャラ数、dyn/eval.ts:305 出荷済。B05030 a2 の apDelta{dyn} 同型)。
// a2: 自身の【カットイン】(icon-cutin = D11013 同型 type:triggered/scope:on-hand/effect:declared selfOnly)。
//     【自分ターン中】= ability.condition turn self。「【黒】のキャラに【カットイン】する場合 AP+2000」=
//     effect conditional{ if: contactTargetMatches(colors黒) (=自コンタクトキャラが黒、BUG-177), then: charModifyAP
//     $contact.byUid +2000 scope:contact }。AP0 base ゆえ黒相手時のみ +2000。

import type { AbilityDef, CardDef } from '@/engine/types';
import { contactTargetMatches } from '../_shared/contactTargetMatches.js';

const a1: AbilityDef = {
  id: 'a1',
  type: 'continuous',
  scope: 'on-scene',
  // 【パートナー黒】かつ【自分ターン中】
  condition: {
    kind: 'and',
    cs: [
      { kind: 'partnerColor', color: '黒' },
      { kind: 'turn', player: 'self' },
    ],
  },
  // 相手の現場のキャラ1枚につき AP+2000
  continuousModifier: { apDelta: { dyn: '$self.oppSceneCount * 2000' } },
  description: '【パートナー黒】【自分ターン中】相手の現場のキャラ1枚につきAP＋2000。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  // 2026-05-27 Option C: icon-cutin → triggered + trigger:{hook:'effect:declared',optional:true,selfOnly:true}
  type: 'triggered',
  scope: 'on-hand',
  trigger: { hook: 'effect:declared', optional: true, selfOnly: true },
  condition: { kind: 'turn', player: 'self' }, // 【自分ターン中】
  // 【黒】のキャラに【カットイン】する場合 (=コンタクト中の自分のキャラが黒、BUG-177/B02006 公式QA) → AP+2000
  effect: {
    kind: 'conditional',
    if: contactTargetMatches({ colors: ['黒'] }),
    then: { kind: 'atom', verb: 'charModifyAP', args: { uid: '$contact.byUid', delta: 2000, scope: 'contact' } },
  },
  description: '【カットイン】【自分ターン中】[黒]のキャラに【カットイン】する場合、AP＋2000。',
  ruleRefs: ['rules/09-cutin-disguise.md', 'rules/22-qa-action-contact.md'],
};

export const B08086: CardDef = {
  id: 'B08086',
  no: '0922/B08086',
  kind: 'character',
  names: ['テキーラ'],
  colors: ['黒'],
  level: 5,
  ap: 0,
  lp: 0,
  traits: ['黒ずくめの組織'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1770731255853718.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/09-cutin-disguise.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/22-qa-action-contact.md',
  ],
};
