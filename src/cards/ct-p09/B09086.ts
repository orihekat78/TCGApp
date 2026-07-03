// cards/ct-p09/B09086 諸伏高明 (character) — card-authoring CARD PHASE #3 (cutin:used observer, engine変更0, 2026-07-03)
// rules: 08-contact.md, 09-cutin-disguise.md, 17-icons.md, 22-qa-action-contact.md
//
// 公式テキスト:
//   このキャラのコンタクト中に自分が〚カード名［諸伏景光］〛か〚特徴［長野県警］〛のキャラの【カットイン】を
//   使用したとき、そのコンタクト中、このキャラをAP＋2000する。
//
// a1: cutin:used observer (B03118 キール 同型 + 使用 cutin の名/特徴 filter)。
//   trigger matcher = and[ triggerPlayerIs self,
//     or[ triggerCutinMatches{cardName:諸伏景光,kind:character}, triggerCutinMatches{trait:長野県警,kind:character} ] ]
//     = 「自分が」+「使用した【カットイン】のカードが 諸伏景光 か 長野県警 のキャラ」。
//     ★triggerCutinMatches は wave-3 で本カード向けに出荷済 (cond/eval.ts:533、payload.cardId を matchOneFilter,
//      c=null 印字 def 値で評価)。カード名/特徴は character 印字ゆえ kind:'character' を付与 (「のキャラ」に忠実)。
//   「このキャラのコンタクト中」guard = effect conditional{if} に置く (B03118/D11013 同型)。理由: handleHook の
//     condition-eval ctx は .contact 未設定 (triggered.ts:300) → ability.condition で ctx.contact を読むと常時 false。
//     ctx.contact が populate されるのは queue 後 runtime ctx (resolve/stack.entryToCtx, BUG-104) = effect の if 評価時。
//     ctx.contact.byUid = p 視点の自コンタクトキャラ (flow/contact.ts:55/73 contactCharUidOf、攻撃側でも防御側でも
//     自分の参加キャラ) → 成立時 byUid === source.uid = このキャラ。limit 無しゆえ guard を trigger→effect に
//     移しても発動回数の観測差ゼロ (guard 不成立時 effect no-op)。$contact.byUid = cutin:used emit の contactBindings。
//   QA: 結果的に何も起こらない【カットイン】(自ターン中使用の【相手ターン中】cutin 等) でも発動 /
//     相手アクションで指定された・自分がガードしたコンタクトでも発動 (byUid=自参加キャラのため両立) /
//     使用した【カットイン】自身の AP+ と本能力の AP+2000 は両方適用 (別効果、scope:'contact' で加算)。

import type { AbilityDef, CardDef, EffectCtx, GameState } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  // 自分が〚カード名[諸伏景光]〛か〚特徴[長野県警]〛のキャラの【カットイン】を使用したとき
  trigger: {
    hook: 'cutin:used',
    matcherCondition: {
      kind: 'and',
      cs: [
        { kind: 'triggerPlayerIs', side: 'self' },
        {
          kind: 'or',
          cs: [
            { kind: 'triggerCutinMatches', filter: { cardName: '諸伏景光', kind: 'character' } },
            { kind: 'triggerCutinMatches', filter: { trait: '長野県警', kind: 'character' } },
          ],
        },
      ],
    },
  },
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
  description:
    'このキャラのコンタクト中に自分が〚カード名[諸伏景光]〛か〚特徴[長野県警]〛のキャラの【カットイン】を使用したとき、そのコンタクト中このキャラをAP+2000。',
  ruleRefs: ['rules/08-contact.md', 'rules/09-cutin-disguise.md', 'rules/22-qa-action-contact.md'],
};

export const B09086: CardDef = {
  id: 'B09086',
  no: '1026/B09086',
  kind: 'character',
  names: ['諸伏高明'],
  colors: ['黄'],
  level: 5,
  ap: 5000,
  lp: 1,
  traits: ['警察', '長野県警'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1775608926276511.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/08-contact.md',
    'rules/09-cutin-disguise.md',
    'rules/17-icons.md',
    'rules/22-qa-action-contact.md',
  ],
};
