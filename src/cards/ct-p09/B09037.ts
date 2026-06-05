// cards/ct-p09/B09037 工藤優作 (キャラ) — catalog-reuse batch
// rules: 13-keywords.md, 15-abilities-effects.md, 17-icons.md, 24-qa-naming-stun.md
//
// 公式テキスト:
//   〚突撃［キャラ］〛（名乗り状態でもアクション［キャラ］できる）
//   【絆黒羽盗一】【自分ターン中】AP＋1000
//   【絆工藤有希子】【登場時】ターン終了時までこのキャラは〚突撃［事件］〛（名乗り状態でもアクション［事件］できる）を持つ。
//
// a1: 無条件 〚突撃[キャラ]〛 — keywords:[] に置けない条件無しキーワードは card.keywords で持たせる。
// a2: 【絆黒羽盗一】【自分ターン中】 AP＋1000 (D09006 a1 同型 continuous, and(bond, turn))。
// a3: 【絆工藤有希子】【登場時】 ターン終了時まで〚突撃[事件]〛付与 (D11015 a2 / D08011 a1 同型 enter grant)。

import type { AbilityDef, CardDef } from '@/engine/types';

const a2: AbilityDef = {
  id: 'a2',
  type: 'continuous',
  scope: 'on-scene',
  // 【絆黒羽盗一】かつ【自分ターン中】
  condition: { kind: 'and', cs: [{ kind: 'bond', cardName: '黒羽盗一' }, { kind: 'turn', player: 'self' }] },
  // AP＋1000
  continuousModifier: { apDelta: 1000 },
  description: '【絆黒羽盗一】【自分ターン中】AP＋1000',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

const a3: AbilityDef = {
  id: 'a3',
  type: 'triggered',
  scope: 'on-scene',
  // 【絆工藤有希子】
  condition: { kind: 'bond', cardName: '工藤有希子' },
  // 【登場時】
  trigger: { hook: 'enter', selfOnly: true },
  // ターン終了時までこのキャラは〚突撃[事件]〛を持つ
  effect: { kind: 'atom', verb: 'charGrantKeyword', args: { uid: '$self', kw: '突撃[事件]', scope: 'turn' } },
  description: '【絆工藤有希子】【登場時】ターン終了時までこのキャラは〚突撃［事件］〛を持つ。',
  ruleRefs: ['rules/13-keywords.md', 'rules/17-icons.md'],
};

export const B09037: CardDef = {
  id: 'B09037',
  no: '0980/B09037',
  kind: 'character',
  names: ['工藤優作'],
  colors: ['白'],
  level: 5,
  ap: 5000,
  lp: 1,
  traits: ['小説家'],
  keywords: ['突撃[キャラ]'], // 無条件 〚突撃［キャラ］〛
  rarity: 'R',
  imageUrl: '1775608835917682.jpg',
  abilities: [a2, a3],
  ruleRefs: [
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/24-qa-naming-stun.md',
  ],
};
