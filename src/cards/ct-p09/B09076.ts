// cards/ct-p09/B09076 三池苗子 (character) — engine拡張 wave (evidence-flip-faceup 有効化, 2026-06-23)
// rules: rules/03-field-areas.md, rules/09-cutin-disguise.md, rules/13-keywords.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/22-qa-action-contact.md
//
// 公式テキスト:
//   【疾風】相手の裏向きの証拠を1つまで選び、表向きにする。（自分の現場にこのターンで1番に登場したときに発動する）
//   【カットイン】【自分ターン中】AP＋2000（自分のターンのコンタクト中に手札からリムーブして使う）
//
// 句マッピング:
//   - 【疾風】 => a1 trigger {hook:'enter', selfOnly:true, matcherCondition:{kind:'enterOrderEquals', n:1}}
//     (このターン1番目の登場で発火。D11009.ts a2 / D11003.ts a1 VERBATIM。BUG-100: enterOrderThisTurn 参照)
//   - 相手の裏向きの証拠を1つまで選び、表向きにする => atom evidenceFlip {player:'opp', max:1, faceDown:true}
//     (engine拡張 wave 2026-06-23 pick-form。B07064.ts a1 同型)
//   - 【カットイン】【自分ターン中】AP＋2000 => a2 (VERBATIM B02007.ts a1 構造、delta +2000)

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  // 【疾風】= このターン1番目に登場で発火
  trigger: { hook: 'enter', selfOnly: true, matcherCondition: { kind: 'enterOrderEquals', n: 1 } },
  // 相手の裏向きの証拠を1つまで選び、表向きにする
  effect: { kind: 'atom', verb: 'evidenceFlip', args: { player: 'opp', max: 1, faceDown: true } },
  description: '【疾風】相手の裏向きの証拠を1つまで選び、表向きにする。（自分の現場にこのターンで1番に登場したときに発動する）',
  ruleRefs: ['rules/03-field-areas.md', 'rules/13-keywords.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md'],
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

export const B09076: CardDef = {
  id: 'B09076',
  no: '1016/B09076',
  kind: 'character',
  names: ['三池苗子'],
  colors: ['黄'],
  level: 2,
  ap: 1000,
  lp: 1,
  traits: ['警察', '警視庁'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1775608910279568.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/09-cutin-disguise.md',
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/22-qa-action-contact.md',
  ],
};
