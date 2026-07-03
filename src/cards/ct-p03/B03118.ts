// cards/ct-p03/B03118 キール (character) — card-authoring wave16 (cutin:used observer 初 consumer, engine変更0, 2026-07-03)
// rules: 08-contact.md, 09-cutin-disguise.md, 10-action-event.md, 17-icons.md, 22-qa-action-contact.md
//
// 公式テキスト:
//   このキャラのコンタクト中に自分が【カットイン】を使用したとき、そのコンタクト中、このキャラをAP＋1000する。
//   【ヒラメキ】（証拠からリムーブされるときに発動する）カードを1枚引く。
//
// a1: cutin:used observer (自分が【カットイン】使用 = triggerPlayerIs self)。
//     「このキャラのコンタクト中」= このキャラ自身がコンタクト参加者 = source.uid === ctx.contact.byUid。
//     ★この guard は effect の conditional{if} に置く (D11013 と同型)。理由: handleHook の
//     condition-eval ctx は .contact 未設定 (triggered.ts:300 bindings:{}) のため ability.condition で
//     ctx.contact を読むと undefined で常時 false。ctx.contact が populate されるのは queue 後の
//     runtime ctx (resolve/stack.entryToCtx, BUG-104) = effect 内 conditional の if 評価時。
//     B03118 は【ターン1】等の limit を持たないため、guard を trigger→effect に移しても発動回数の観測差ゼロ
//     (guard 不成立時は effect が no-op = 発火した扱いだが後続影響なし)。$contact.byUid = contact.cutIn emit の
//     contactBindings (byUid = カットイン側の参加者)。guard 成立時 byUid === source.uid なので対象はこのキャラ。
// a2: 【ヒラメキ】カードを1枚引く (evidence:remove-by-action, optional)。

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
    // そのコンタクト中、このキャラを AP+1000 (scope:contact = コンタクト終了時に切れる)
    then: { kind: 'atom', verb: 'charModifyAP', args: { uid: '$contact.byUid', delta: 1000, scope: 'contact' } },
  },
  description: 'このキャラのコンタクト中に自分が【カットイン】を使用したとき、このコンタクト中このキャラをAP+1000。',
  ruleRefs: ['rules/08-contact.md', 'rules/09-cutin-disguise.md', 'rules/22-qa-action-contact.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-evidence',
  trigger: { hook: 'evidence:remove-by-action', optional: true }, // 【ヒラメキ】任意発動
  effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
  description: '【ヒラメキ】カードを1枚引く。',
  ruleRefs: ['rules/10-action-event.md', 'rules/17-icons.md'],
};

export const B03118: CardDef = {
  id: 'B03118',
  no: '0367/B03118',
  kind: 'character',
  names: ['キール'],
  colors: ['黒'],
  level: 3,
  ap: 3000,
  lp: 1,
  traits: ['黒ずくめの組織'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1729133483028419.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/08-contact.md',
    'rules/09-cutin-disguise.md',
    'rules/10-action-event.md',
    'rules/17-icons.md',
    'rules/22-qa-action-contact.md',
  ],
};
