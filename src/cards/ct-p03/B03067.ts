// cards/ct-p03/B03067 沖矢昴 (キャラ) — catalog-reuse batch
// rules: 03-field-areas.md, 07-action-flow.md, 13-keywords.md, 15-abilities-effects.md, 17-icons.md, 19-special-rules.md, 21-declared-ability-cost.md
//
// 公式テキスト:
//   〚突撃〛（登場したターンからすぐにアクションできる）
//   【パートナー赤】【自分ターン中】AP＋1000
//   【パートナー赤】【宣言】【ターン1】〚現場にいるレベル7以上のカード名［赤井秀一］かレベル7以上のカード名［ライ］をリムーブする〛：このキャラをアクティブにする。
//
// a1: 無条件キーワード 〚突撃〛 → keywords:['突撃']。
// a2: 常時有効 — 【パートナー赤】【自分ターン中】 AP＋1000 (continuousModifier.apDelta / D08005 a1 同型)。
// a3: 宣言能力 — 【パートナー赤】【ターン1】cost removeFromScene{pick: cardName[赤井秀一|ライ] levelMin7 side self}。
//     効果 sceneSetState active self (uid:'$self' / D11016 同型)。

import type { AbilityDef, CardDef } from '@/engine/types';

// a2: 【パートナー赤】【自分ターン中】AP＋1000
const a2: AbilityDef = {
  id: 'a2',
  type: 'continuous',
  scope: 'on-scene',
  // 【パートナー赤】【自分ターン中】
  condition: { kind: 'and', cs: [{ kind: 'partnerColor', color: '赤' }, { kind: 'turn', player: 'self' }] },
  // AP＋1000
  continuousModifier: { apDelta: 1000 },
  description: '【パートナー赤】【自分ターン中】AP＋1000。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

// a3: 【パートナー赤】【宣言】【ターン1】〚現場のレベル7以上[赤井秀一]か[ライ]をリムーブ〛: このキャラをアクティブにする。
const a3: AbilityDef = {
  id: 'a3',
  type: 'declared',
  scope: 'on-scene',
  // 【パートナー赤】
  condition: { kind: 'partnerColor', color: '赤' },
  limit: { kind: 'turn', n: 1 },
  // 〚現場にいるレベル7以上のカード名[赤井秀一]かレベル7以上のカード名[ライ]をリムーブする〛 (自分の現場 / rules/21)
  cost: { kind: 'removeFromScene', target: { kind: 'pick', query: { area: 'scene', side: 'self', filterAny: [{ cardName: '赤井秀一', levelMin: 7 }, { cardName: 'ライ', levelMin: 7 }] }, n: { min: 1, max: 1 }, chooser: 'self' }, n: 1 },
  // このキャラをアクティブにする
  effect: { kind: 'atom', verb: 'sceneSetState', args: { uid: '$self', state: 'active' } },
  description: '【パートナー赤】【宣言】【ターン1】〚現場のレベル7以上[赤井秀一]か[ライ]をリムーブ〛：このキャラをアクティブにする。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/21-declared-ability-cost.md'],
};

export const B03067: CardDef = {
  id: 'B03067',
  no: '0321/B03067',
  kind: 'character',
  names: ['沖矢昴'],
  colors: ['赤'],
  level: 7,
  ap: 5000,
  lp: 1,
  traits: ['大学院生'],
  keywords: ['突撃'],
  rarity: 'R',
  imageUrl: '1729133406844688.jpg',
  abilities: [a2, a3],
  ruleRefs: [
    'rules/07-action-flow.md',
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md',
  ],
};
