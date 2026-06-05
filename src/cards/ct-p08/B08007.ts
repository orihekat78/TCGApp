// cards/ct-p08/B08007 円谷光彦 (キャラ) — catalog-reuse batch
// rules: 13-keywords.md, 15-abilities-effects.md, 16-card-set.md, 17-icons.md, 21-declared-ability-cost.md
//
// 公式テキスト:
//   【パートナー青】〚突撃［事件］〛
//   【自分ターン中】このキャラの下に重なっているカードの数につき、以下の能力を持つ。
//   【1枚以上】AP＋1000、〚突撃［キャラ］〛
//   【3枚以上】【FILE5】【宣言】【ターン1】〚手札を1枚リムーブする〛：このキャラをアクティブにする。
//
// a1: 【パートナー青】〚突撃[事件]〛 — partnerColorKeyword 共通 (D11007 a2 同型)。
// a2: 【自分ターン中】【1枚以上】AP＋1000 — continuous (turn + stackedCountAtLeast n:1, apDelta:1000) (D08021 a2/a3 同型)。
// a3: 【自分ターン中】【1枚以上】〚突撃[キャラ]〛 — continuous grantKeywords (同上条件) (D08021 a2 同型)。
// a4: 【自分ターン中】【3枚以上】【FILE5】【宣言】【ターン1】〚手札1リム〛: このキャラをアクティブに
//     — declared (and(turn, stackedCountAtLeast n:3, fileAtLeast n:5), cost removeFromHand n:1, sceneSetState active $self) (D11016/B01088 同型)。

import type { AbilityDef, CardDef } from '@/engine/types';
import { partnerColorKeyword } from '@/cards/_shared';

// a1: 【パートナー青】〚突撃[事件]〛
const a1: AbilityDef = partnerColorKeyword({ color: '青', kw: '突撃[事件]', abilityId: 'a1' });

const a2: AbilityDef = {
  id: 'a2',
  type: 'continuous',
  scope: 'on-scene',
  // 【自分ターン中】【1枚以上】
  condition: { kind: 'and', cs: [{ kind: 'turn', player: 'self' }, { kind: 'stackedCountAtLeast', ref: { kind: 'self' }, n: 1 }] },
  // AP＋1000
  continuousModifier: { apDelta: 1000 },
  description: '【自分ターン中】【1枚以上】AP＋1000',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/16-card-set.md'],
};

const a3: AbilityDef = {
  id: 'a3',
  type: 'continuous',
  scope: 'on-scene',
  // 【自分ターン中】【1枚以上】
  condition: { kind: 'and', cs: [{ kind: 'turn', player: 'self' }, { kind: 'stackedCountAtLeast', ref: { kind: 'self' }, n: 1 }] },
  // 〚突撃[キャラ]〛
  continuousModifier: { grantKeywords: () => ['突撃[キャラ]'] },
  description: '【自分ターン中】【1枚以上】〚突撃[キャラ]〛',
  ruleRefs: ['rules/13-keywords.md', 'rules/16-card-set.md'],
};

const a4: AbilityDef = {
  id: 'a4',
  type: 'declared',
  scope: 'on-scene',
  // 【自分ターン中】【3枚以上】【FILE5】
  condition: { kind: 'and', cs: [{ kind: 'turn', player: 'self' }, { kind: 'stackedCountAtLeast', ref: { kind: 'self' }, n: 3 }, { kind: 'fileAtLeast', n: 5 }] },
  limit: { kind: 'turn', n: 1 },
  // 〚手札を1枚リムーブする〛
  cost: { kind: 'removeFromHand', target: { kind: 'pick', query: { area: 'hand', side: 'self' }, n: { min: 1, max: 1 }, chooser: 'self' }, n: 1 },
  // このキャラをアクティブにする
  effect: { kind: 'atom', verb: 'sceneSetState', args: { uid: '$self', state: 'active' } },
  description: '【自分ターン中】【3枚以上】【FILE5】【宣言】【ターン1】〚手札を1枚リムーブする〛：このキャラをアクティブにする。',
  ruleRefs: ['rules/16-card-set.md', 'rules/17-icons.md', 'rules/21-declared-ability-cost.md'],
};

export const B08007: CardDef = {
  id: 'B08007',
  no: '0848/B08007',
  kind: 'character',
  names: ['円谷光彦'],
  colors: ['青'],
  level: 8,
  ap: 7000,
  lp: 1,
  traits: ['少年探偵団'],
  keywords: [],
  rarity: 'R',
  imageUrl: '1770731204297755.jpg',
  abilities: [a1, a2, a3, a4],
  ruleRefs: [
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/16-card-set.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md',
  ],
};
