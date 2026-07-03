// cards/ct-p01/B01012 阿笠博士 (character) — engine mega-wave W4 r83 exemplar (enter:group + fromGroup, 2026-07-03)
// rules: 13-keywords.md (迅速), 15-abilities-effects.md, 17-icons.md (【ターン①】), 24-qa-naming-stun.md
//
// 公式テキスト:
//   【ターン1】能力や効果によってレベル6以下の〚特徴［少年探偵団］〛のキャラが自分の現場に登場したとき、
//   その中から1枚をアクティブにし、ターン終了時までそのキャラに〚迅速〛（登場したターンからすぐに
//   推理かアクションできる）を与える。
//
// 「能力や効果によって…登場したとき」= enter:group hook (W4 r83、atomSceneEnter/atomSceneSwitch の
//   viaEffect=true batch 単位 emit。手札の使用/ネクストヒントでは emit されない)。
// 「レベル6以下の[少年探偵団]が…登場した」= condition boundAnyMatchesFilter{enterGroup} (発動条件 —
//   不成立なら発動自体せず【ターン1】未消費、rules/24)。「自分の現場に」= triggerPlayerIs self。
// 「その中から1枚」= sceneSetState 短縮形 carrier の fromGroup:'enterGroup' (母集合 = 同時登場 batch)。
//   公式Q&A「2枚以上登場した場合 → その中から1枚を選択してアクティブにし、迅速を与えます」。
// 「アクティブにし…迅速を与える」= carrier state:'active' + rider charGrantKeyword $picked (wave-9 idiom)。
//   n:1 = 必須選択 (「1枚まで」ではない)。相手ターン中でも発動 (公式Q&A) = turn condition を置かない。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'enter:group' },
  condition: {
    kind: 'and',
    cs: [
      { kind: 'triggerPlayerIs', side: 'self' },
      { kind: 'boundAnyMatchesFilter', bindKey: 'enterGroup', filter: { kind: 'character', levelMax: 6, trait: '少年探偵団' } },
    ],
  },
  limit: { kind: 'turn', n: 1 },
  effect: {
    kind: 'sequence',
    steps: [
      // その中から1枚をアクティブにする (carrier: 短縮形必須 — 明示 uid:'$pick' は rider bind 喪失)
      { kind: 'atom', verb: 'sceneSetState', args: { player: 'self', side: 'self', n: 1, state: 'active', fromGroup: 'enterGroup', filter: { kind: 'character', levelMax: 6, trait: '少年探偵団' }, bind: 'picked' } },
      // ターン終了時までそのキャラに〚迅速〛を与える (rider)
      { kind: 'atom', verb: 'charGrantKeyword', args: { uid: '$picked.uid', kw: '迅速', scope: 'turn' } },
    ],
  },
  description: '【ターン1】能力や効果によってレベル6以下の〚特徴［少年探偵団］〛のキャラが自分の現場に登場したとき、その中から1枚をアクティブにし、ターン終了時までそのキャラに〚迅速〛を与える。',
  ruleRefs: ['rules/13-keywords.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

export const B01012: CardDef = {
  id: 'B01012',
  no: '0008/B01012',
  kind: 'character',
  names: ['阿笠博士'],
  colors: ['青'],
  level: 7,
  ap: 6000,
  lp: 1,
  traits: ['発明家'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1714012985498894.jpg',
  abilities: [a1],
  ruleRefs: ['rules/13-keywords.md', 'rules/17-icons.md'],
};
