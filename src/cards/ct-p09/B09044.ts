// cards/ct-p09/B09044 工藤有希子 (キャラ) — catalog-reuse batch
// rules: 10-action-event.md, 14-refresh.md, 15-abilities-effects.md, 19-special-rules.md, 20-color-and-switch.md, 21-declared-ability-cost.md
//
// 公式テキスト:
//   【宣言】【スリープ】〚デッキの下に移す〛：手札からレベル6以下の【青】か【白】のキャラを1枚まで登場させる。
//   【ヒラメキ】（証拠からリムーブされるときに発動する）自分のリムーブエリアにあるレベル6以下の【青】か【白】のキャラを1枚まで選び、手札に加える。
//
// a1: 【宣言】【スリープ】〚デッキの下に移す〛cost (pay[sleepSelf, selfToDeckBottom]) →
//     手札からLv6以下の【青】か【白】を1枚まで登場 (sceneEnter from:'hand' color OR / B05055 a1 同型)。
// a2: 【ヒラメキ】リムーブのLv6以下【青】/【白】を1枚まで手札に加える (handAddFromRemove / B09088 a2 同型)。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'declared',
  scope: 'on-scene',
  // 【スリープ】〚デッキの下に移す〛 (両方を支払う / もともと sleep / stun なら canPay=false で宣言不可)
  cost: { kind: 'pay', items: [{ kind: 'sleepSelf' }, { kind: 'selfToDeckBottom' }] },
  // 手札からレベル6以下の【青】か【白】のキャラを1枚まで登場させる (候補 0 件 / user skip OK)
  effect: {
    kind: 'choice',
    chooser: 'self',
    options: [
      {
        kind: 'atom',
        verb: 'sceneEnter',
        args: {
          player: 'self', cardId: '$pick.cardId', from: 'hand', viaEffect: true,
          target: { kind: 'pick', query: { area: 'hand', side: 'self', filter: { color: ['青', '白'], levelMax: 6 } }, n: { min: 0, max: 1 }, chooser: 'self' },
        },
      },
    ],
  },
  description: '【宣言】【スリープ】〚デッキの下に移す〛：手札からレベル6以下の【青】か【白】のキャラを1枚まで登場させる。',
  ruleRefs: ['rules/21-declared-ability-cost.md', 'rules/15-abilities-effects.md', 'rules/20-color-and-switch.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-evidence',
  trigger: { hook: 'evidence:remove-by-action', optional: true }, // 任意発動
  // 自分のリムーブエリアにあるレベル6以下の【青】か【白】のキャラを1枚まで選び、手札に加える
  effect: { kind: 'atom', verb: 'handAddFromRemove', args: { player: 'self', max: 1, filter: { color: ['青', '白'], levelMax: 6 } } },
  description: '【ヒラメキ】自分のリムーブエリアにあるレベル6以下の【青】か【白】のキャラを1枚まで選び、手札に加える。',
  ruleRefs: ['rules/10-action-event.md', 'rules/14-refresh.md', 'rules/20-color-and-switch.md'],
};

export const B09044: CardDef = {
  id: 'B09044',
  no: '0987/B09044',
  kind: 'character',
  names: ['工藤有希子'],
  colors: ['白'],
  level: 6,
  ap: 4000,
  lp: 1,
  traits: ['女優'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1775608856137332.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/10-action-event.md',
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/19-special-rules.md',
    'rules/20-color-and-switch.md',
    'rules/21-declared-ability-cost.md',
  ],
};
