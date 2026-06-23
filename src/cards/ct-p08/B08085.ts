// cards/ct-p08/B08085 シェリー (character) — engine拡張 wave (evidence-flip-faceup 有効化, 2026-06-23)
// rules: rules/03-field-areas.md, rules/09-cutin-disguise.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/22-qa-action-contact.md
//
// 公式テキスト:
//   【事件青＆黒】【相手ターン中】【現場リムーブ時】相手の裏向きの証拠を1つまで選び、表向きにする。
//   【カットイン】【自分ターン中】AP＋2000（自分のターンのコンタクト中に手札からリムーブして使う）
//
// 句マッピング:
//   - 【現場リムーブ時】 => a1 trigger {hook:'leave:to-remove', selfOnly:true} (自カードのリムーブで発火、D01012.ts a1 同型)
//   - 【事件青＆黒】【相手ターン中】 => a1.condition = and[ caseColor{color:['青','黒'],combine:'and'},
//     turn{player:'opp'} ] (caseColor and-form: eval.ts L52-54 want.every / D01012 turn:opp。
//     条件未充足なら「持っていない扱い」rules/17 §条件アイコン → 発火せず)
//   - 相手の裏向きの証拠を1つまで選び、表向きにする => atom evidenceFlip {player:'opp', max:1, faceDown:true}
//     (engine拡張 wave 2026-06-23 pick-form。相手=card owner の opponent、turn に依らず固定。B07064.ts a1 同型)
//   - 【カットイン】【自分ターン中】AP＋2000 => a2 {scope:'on-hand', trigger:{hook:'effect:declared',
//     optional:true, selfOnly:true}, condition:turn{self}, charModifyAP $contact.byUid +2000 contact}
//     (VERBATIM B02007.ts a1 構造、delta のみ +2000)

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'leave:to-remove', selfOnly: true }, // 【現場リムーブ時】(このキャラ自身)
  // 【事件青＆黒】【相手ターン中】
  condition: {
    kind: 'and',
    cs: [
      { kind: 'caseColor', color: ['青', '黒'], combine: 'and' },
      { kind: 'turn', player: 'opp' },
    ],
  },
  // 相手の裏向きの証拠を1つまで選び、表向きにする
  effect: { kind: 'atom', verb: 'evidenceFlip', args: { player: 'opp', max: 1, faceDown: true } },
  description: '【事件青＆黒】【相手ターン中】【現場リムーブ時】相手の裏向きの証拠を1つまで選び、表向きにする。',
  ruleRefs: ['rules/03-field-areas.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-hand',
  trigger: { hook: 'effect:declared', optional: true, selfOnly: true }, // 【カットイン】(コンタクト中に手札から使用)
  condition: { kind: 'turn', player: 'self' }, // 【自分ターン中】
  // 【カットイン】AP＋2000 — コンタクト中の攻撃キャラ ($contact.byUid) を contact scope で加算
  effect: { kind: 'atom', verb: 'charModifyAP', args: { uid: '$contact.byUid', delta: 2000, scope: 'contact' } },
  description: '【カットイン】【自分ターン中】AP＋2000（自分のターンのコンタクト中に手札からリムーブして使う）',
  ruleRefs: ['rules/09-cutin-disguise.md', 'rules/22-qa-action-contact.md'],
};

export const B08085: CardDef = {
  id: 'B08085',
  no: '0921/B08085',
  kind: 'character',
  names: ['シェリー'],
  colors: ['黒'],
  level: 2,
  ap: 1000,
  lp: 1,
  traits: ['黒ずくめの組織'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1770731255847706.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/09-cutin-disguise.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/22-qa-action-contact.md',
  ],
};
