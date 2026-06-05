// cards/ct-p03/B03010 小嶋元太 (キャラ) — catalog-reuse batch
// rules: 03-field-areas.md, 09-cutin-disguise.md, 15-abilities-effects.md, 17-icons.md, 21-declared-ability-cost.md, 22-qa-action-contact.md
//
// 公式テキスト:
//   【宣言】【スリープ】：レベル6以下のキャラを1枚まで選び、スリープさせる。
//   【カットイン】AP＋1000（コンタクト中に手札からリムーブして使う）
//
// a1: 【宣言】〚スリープ〛コスト (sleepSelf) → レベル6以下のキャラを1枚まで選びスリープ (sceneSetState 短縮形)
// a2: 【カットイン】AP＋1000 — D08015 a2 同型 ($contact.byUid を contact scope で +1000)

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'declared',
  scope: 'on-scene',
  // 【スリープ】: コストとして自身をスリープさせる
  cost: { kind: 'sleepSelf' },
  // レベル6以下のキャラを1枚まで選び、スリープさせる
  effect: { kind: 'atom', verb: 'sceneSetState', args: { player: 'self', max: 1, side: 'either', state: 'sleep', filter: { levelMax: 6 } } },
  description: '【宣言】【スリープ】：レベル6以下のキャラを1枚まで選び、スリープさせる。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/21-declared-ability-cost.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-hand',
  trigger: { hook: 'effect:declared', optional: true, selfOnly: true }, // 【カットイン】(コンタクト中に手札から使用)
  // AP＋1000 — コンタクト中の攻撃キャラ ($contact.byUid) を contact scope で加算
  effect: { kind: 'atom', verb: 'charModifyAP', args: { uid: '$contact.byUid', delta: 1000, scope: 'contact' } },
  description: '【カットイン】AP＋1000',
  ruleRefs: ['rules/09-cutin-disguise.md', 'rules/22-qa-action-contact.md'],
};

export const B03010: CardDef = {
  id: 'B03010',
  no: '0268/B03010',
  kind: 'character',
  names: ['小嶋元太'],
  colors: ['青'],
  level: 5,
  ap: 3000,
  lp: 1,
  traits: ['少年探偵団'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1729133048287486.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/09-cutin-disguise.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md',
  ],
};
