// cards/ct-p03/B03112 ライ (character) — attribution mini-wave ① byPlayer:'self' (2026-07-10, engine変更0)
// rules: 03-field-areas.md, 08-contact.md, 09-cutin-disguise.md, 13-keywords.md, 15-abilities-effects.md, 17-icons.md, 22-qa-action-contact.md
//
// 公式テキスト:
//   〚突撃〛（登場したターンからすぐにアクションできる）
//   このキャラのコンタクト中に自分が【カットイン】を使用したとき、そのコンタクト中、このキャラをAP＋2000する。
//   【自分ターン中】【ターン1】自分の現場にいる【黒】のキャラが自分の能力や効果によってリムーブされたとき、
//     ターン終了時までこのキャラをLP＋1する。
//
// 句マッピング:
//   - 〚突撃〛 => keywords:['突撃'] (rules/13、exemplar src/cards/ct-p03/B03067.ts a1)
//   - このキャラのコンタクト中に自分が【カットイン】を使用したとき、そのコンタクト中このキャラをAP＋2000
//       => a1: cutin:used observer (triggerPlayerIs self=「自分が使用」)。「このキャラのコンタクト中」=
//          このキャラ自身がコンタクト参加者 = ctx.contact.byUid === source.uid を effect の conditional{if} で判定
//          (ability.condition は ctx.contact 未 populate のため runtime ctx = effect 内で読む、B03118 と同型)。
//          → charModifyAP $contact.byUid +2000 scope:contact (そのコンタクト中=終了時に切れる)。
//          exemplar: src/cards/ct-p03/B03118.ts a1 (AP+1000 の同 idiom、delta 差替のみ)。
//          Q&A: 自ターン/相手ターン等 結果的に何も起きない【カットイン】でも発動 / 相手アクション被指定・ガード
//               起因のコンタクトでも発動 / 使用カットイン自体の AP+ も別途加算 (= 本能力は独立 +2000)。
//   - 【自分ターン中】【ターン1】自分の現場にいる【黒】が自分の能力や効果によってリムーブされたとき、
//     ターン終了時までこのキャラをLP＋1
//       => a2: 【自分ターン中】=condition turn:self / 【ターン1】=limit turn1 /
//          trigger leave:to-remove (非 selfOnly=このキャラ以外の【黒】も対象) +
//          matcherCondition removedCharMatches{side:'self', cause:'effect', byPlayer:'self', removedFilter:{color:'黒'}}
//          (side:'self'=「自分の現場にいる」/ removedFilter color黒=「【黒】のキャラ」/ cause:'effect'+byPlayer:'self'=
//           「自分の能力や効果によって」cond/eval.ts:731、スイッチ非発火 は cause gate)
//          → charModifyLP $self +1 scope:turn (「ターン終了時までこのキャラをLP＋1」exemplar D01003 a1 / B04011)。
//          exemplar 構造: src/cards/ct-p03/B03038.ts a1 (condition turn + limit turn1 + matcherCondition + 反応) /
//                        removedCharMatches 消費 = src/cards/ct-d06/D06009.ts a1 (matcherCondition) /
//                        byPlayer gate = cond/eval.ts:731 / removedFilter = types/effect.ts:187。

import type { AbilityDef, CardDef, EffectCtx, GameState } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  // 自分が【カットイン】を使用したとき (triggerPlayerIs self = payload.player === owner)
  trigger: { hook: 'cutin:used', matcherCondition: { kind: 'triggerPlayerIs', side: 'self' } },
  effect: {
    kind: 'conditional',
    // このキャラのコンタクト中 = このキャラ自身がコンタクト参加者 (byUid === 自 uid、runtime ctx で評価)
    if: {
      kind: 'custom',
      check: (_s: GameState, ctx: EffectCtx) => ctx.contact?.byUid === ctx.source.uid,
    },
    // そのコンタクト中、このキャラを AP+2000 (scope:contact = コンタクト終了時に切れる)
    then: { kind: 'atom', verb: 'charModifyAP', args: { uid: '$contact.byUid', delta: 2000, scope: 'contact' } },
  },
  description: 'このキャラのコンタクト中に自分が【カットイン】を使用したとき、そのコンタクト中このキャラをAP＋2000する。',
  ruleRefs: ['rules/08-contact.md', 'rules/09-cutin-disguise.md', 'rules/22-qa-action-contact.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-scene',
  condition: { kind: 'turn', player: 'self' }, // 【自分ターン中】
  limit: { kind: 'turn', n: 1 }, // 【ターン1】
  trigger: {
    hook: 'leave:to-remove',
    // 自分の現場にいる【黒】のキャラが自分の能力や効果によってリムーブされたとき
    matcherCondition: {
      kind: 'removedCharMatches',
      side: 'self',
      cause: 'effect',
      byPlayer: 'self',
      removedFilter: { color: '黒' },
    },
  },
  // ターン終了時までこのキャラをLP＋1する
  effect: { kind: 'atom', verb: 'charModifyLP', args: { uid: '$self', delta: 1, scope: 'turn' } },
  description:
    '【自分ターン中】【ターン1】自分の現場にいる【黒】のキャラが自分の能力や効果によってリムーブされたとき、ターン終了時までこのキャラをLP＋1する。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

export const B03112: CardDef = {
  id: 'B03112',
  no: '0361/B03112',
  kind: 'character',
  names: ['ライ'],
  colors: ['黒'],
  level: 7,
  ap: 5000,
  lp: 1,
  traits: ['黒ずくめの組織'],
  keywords: ['突撃'], // 〚突撃〛
  rarity: 'SR',
  imageUrl: '1729133482967362.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/08-contact.md',
    'rules/09-cutin-disguise.md',
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/22-qa-action-contact.md',
  ],
};
