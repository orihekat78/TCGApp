// cards/ct-p04/B04090 ライ (character) — card-authoring CARD PHASE #3 (cutin:used observer, engine変更0, 2026-07-03)
// rules: 08-contact.md, 09-cutin-disguise.md, 13-keywords.md, 17-icons.md, 20-color-and-switch.md, 22-qa-action-contact.md
//
// 公式テキスト:
//   【パートナー黒】〚突撃［キャラ］〛（登場したターンからすぐにキャラを指定してアクションできる）
//   このキャラのコンタクト中に自分が【カットイン】を使用したとき、自分のリムーブエリアにある
//   レベル3以下の【黒】のキャラを1枚まで選び、登場させる。
//
// a1: 【パートナー黒】〚突撃[キャラ]〛 = 常時有効 grantKeywords (partnerColorKeyword 共通クラス、
//     kw 文字列 '突撃[キャラ]' は action gate が honor: flow/main/action.ts、B01094/D09027 前例)。
// a2: cutin:used observer (B03118 キール 同型、使用 cutin は無条件 = matcher は triggerPlayerIs self のみ)。
//   「このキャラのコンタクト中」guard = effect conditional{if} に置く (ctx.contact は runtime ctx でのみ populate、
//     triggered.ts:300 の ability.condition では読めない = B03118 教訓)。ctx.contact.byUid = p 視点の自コンタクト
//     キャラ (flow/contact.ts:55/73、攻撃側でも防御側でも自分の参加キャラ) → 成立時 = このキャラ。
//   then「リムーブの【黒】レベル3以下キャラ1枚まで選び登場」= sceneEnter from:'remove' (B08029 deployStep 同型、
//     効果による登場ゆえ viaEffect:true = rules/20 色制限 exempt + 【登場時】発火 + rules/06 名乗り登場)。
//     n:{min:0,max:1} =「1枚まで」= 0枚可 (rules/15)。filter kind:'character' (BUG-123、イベント混入除外)。
//   QA: 使用【カットイン】がレベル3以下【黒】キャラなら (リムーブ済ゆえ) それ自身を選べる /
//     何も起こらない【カットイン】でも発動 / 相手アクション指定・自ガードのコンタクトでも発動 /
//     現場が既に5枚でもスイッチで登場可 (sceneEnter が現場上限処理を担う)。

import type { AbilityDef, CardDef, EffectCtx, GameState } from '@/engine/types';

import { partnerColorKeyword } from '../_shared/partnerColorKeyword.js';

// a1: 【パートナー黒】〚突撃[キャラ]〛
const a1: AbilityDef = partnerColorKeyword({ color: '黒', kw: '突撃[キャラ]', abilityId: 'a1' });

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-scene',
  // このキャラのコンタクト中に自分が【カットイン】を使用したとき
  trigger: { hook: 'cutin:used', matcherCondition: { kind: 'triggerPlayerIs', side: 'self' } },
  effect: {
    kind: 'conditional',
    // このキャラのコンタクト中 = このキャラ自身がコンタクト参加者 (byUid === 自 uid、runtime ctx で評価)
    if: {
      kind: 'custom',
      check: (_s: GameState, ctx: EffectCtx) => ctx.contact?.byUid === ctx.source.uid,
    },
    // 自分のリムーブエリアにあるレベル3以下の【黒】のキャラを1枚まで選び、登場させる
    then: {
      kind: 'atom',
      verb: 'sceneEnter',
      args: {
        player: 'self',
        cardId: '$pick.cardId',
        from: 'remove',
        viaEffect: true,
        target: {
          kind: 'pick',
          query: { area: 'remove', side: 'self', filter: { color: '黒', levelMax: 3, kind: 'character' } },
          n: { min: 0, max: 1 },
          chooser: 'self',
        },
      },
    },
  },
  description:
    'このキャラのコンタクト中に自分が【カットイン】を使用したとき、自分のリムーブエリアにあるレベル3以下の【黒】のキャラを1枚まで選び、登場させる。',
  ruleRefs: ['rules/08-contact.md', 'rules/09-cutin-disguise.md', 'rules/20-color-and-switch.md', 'rules/22-qa-action-contact.md'],
};

export const B04090: CardDef = {
  id: 'B04090',
  no: '0472/B04090',
  kind: 'character',
  names: ['ライ'],
  colors: ['黒'],
  level: 8,
  ap: 8000,
  lp: 2,
  traits: ['黒ずくめの組織'],
  keywords: [],
  rarity: 'R',
  imageUrl: '1735287841308869.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/08-contact.md',
    'rules/09-cutin-disguise.md',
    'rules/13-keywords.md',
    'rules/17-icons.md',
    'rules/20-color-and-switch.md',
    'rules/22-qa-action-contact.md',
  ],
};
