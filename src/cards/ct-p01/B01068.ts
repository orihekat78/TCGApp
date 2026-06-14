// cards/ct-p01/B01068 赤井秀一 (キャラ) — engine拡張 wave#2 cluster3 (action[事件] trigger)
// rules: 07-action-flow.md, 10-action-event.md, 13-keywords.md, 22-qa-action-contact.md, 15-abilities-effects.md, 17-icons.md
//
// 公式テキスト:
//   このキャラがアクション［事件］したとき、ターン終了時までこのキャラは〚ブレット〛
//   （このキャラのアクションはガードできない）を持つ。
//
// a1: 「このキャラが」= selfOnly:true (source.uid 一致)。
//   「アクション［事件］したとき」= action:declare hook + matcherCondition triggerActionKind{v:'case'}
//     (action[キャラ] では発火させない subtype gate。rules/22 §アクション宣言時に発動 = ガード判定前)。
//   selfOnly と matcherCondition は listener で AND 評価される (triggered.ts:205/:222)。
//   「ターン終了時までこのキャラは〚ブレット〛を持つ」= 必須効果 ("持つ" / "してもよい" でない)。
//     charGrantKeyword{uid:'$self', kw:'ブレット', scope:'turn'} (B03074/D11015 a2 同型)。
//     宣言時 (ガード判定前) に付与されるため guard.ts:46-49 のブレット判定でガード候補が剥奪される
//     (qAndA: ガードをするか決めるよりも前に発動)。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  // このキャラ (selfOnly) がアクション［事件］(triggerActionKind case) したとき
  trigger: {
    hook: 'action:declare',
    selfOnly: true,
    matcherCondition: { kind: 'triggerActionKind', v: 'case' },
  },
  // ターン終了時までこのキャラは〚ブレット〛を持つ
  effect: { kind: 'atom', verb: 'charGrantKeyword', args: { uid: '$self', kw: 'ブレット', scope: 'turn' } },
  description: 'このキャラがアクション［事件］したとき、ターン終了時までこのキャラは〚ブレット〛を持つ。',
  ruleRefs: [
    'rules/07-action-flow.md',
    'rules/10-action-event.md',
    'rules/13-keywords.md',
    'rules/22-qa-action-contact.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
  ],
};

export const B01068: CardDef = {
  id: 'B01068',
  no: '0058/B01068',
  kind: 'character',
  names: ['赤井秀一'],
  colors: ['赤'],
  level: 3,
  ap: 3000,
  lp: 1,
  traits: ['FBI', '赤井家'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1714013053510958.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/07-action-flow.md',
    'rules/10-action-event.md',
    'rules/13-keywords.md',
    'rules/22-qa-action-contact.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
  ],
};
