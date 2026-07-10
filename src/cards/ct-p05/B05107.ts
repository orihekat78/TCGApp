// cards/ct-p05/B05107 ウォッカ (character) — attribution mini-wave ① byPlayer:'self' (2026-07-10, engine変更0)
// rules: 03-field-areas.md, 13-keywords.md, 15-abilities-effects.md, 17-icons.md, 20-color-and-switch.md
//
// 公式テキスト:
//   〚突撃〛（登場したターンからすぐにアクションできる）
//   【パートナー黒】【自分ターン中】自分の現場にいるこのキャラが自分の能力や効果によってリムーブされたとき、
//     このキャラをリムーブエリアからスリープ状態で登場させてもよい。
//
// 句マッピング:
//   - 〚突撃〛 => keywords:['突撃'] (rules/13、exemplar src/cards/ct-p03/B03067.ts a1)
//   - 【パートナー黒】【自分ターン中】 => condition and[partnerColor 黒, turn self]
//   - 自分の現場にいるこのキャラが自分の能力や効果によってリムーブされたとき
//       => trigger leave:to-remove + selfOnly + matcherCondition removedCharMatches{cause:'effect', byPlayer:'self'}
//          (B03116 a1 同型。cause:'effect'=「能力や効果」/スイッチ非発火 は cause gate、byPlayer:'self'= 効果 owner 帰属
//           cond/eval.ts:731)
//   - このキャラをリムーブエリアからスリープ状態で登場させてもよい (B03116 と異なり draw 無し)
//       => effect sceneEnter{from:remove, max:1, filter:{cardId:'B05107',kind:'character'}, enterSleep, viaEffect}
//          「してもよい」= 単一 sceneEnter の max:1 (min0 = 辞退可、rules/15)。B03116 のような後続 draw が無いため
//          optional wrapper は不要 — max:1 自体が「もよい」を表す (exemplar src/cards/ct-d08/D08024.ts a1 が
//          sceneEnter from:remove max:1 を「1枚まで登場」に使用)。filter cardId='B05107' = リムーブの「このキャラ」。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  // 【パートナー黒】【自分ターン中】
  condition: {
    kind: 'and',
    cs: [
      { kind: 'partnerColor', color: '黒' },
      { kind: 'turn', player: 'self' },
    ],
  },
  trigger: {
    hook: 'leave:to-remove',
    selfOnly: true,
    matcherCondition: { kind: 'removedCharMatches', cause: 'effect', byPlayer: 'self' },
  },
  // このキャラをリムーブエリアからスリープ状態で登場させてもよい (max:1 = 「もよい」= 0体辞退可)
  effect: {
    kind: 'atom',
    verb: 'sceneEnter',
    args: {
      player: 'self',
      from: 'remove',
      max: 1,
      viaEffect: true,
      enterSleep: true,
      filter: { cardId: 'B05107', kind: 'character' },
    },
  },
  description:
    '【パートナー黒】【自分ターン中】自分の現場にいるこのキャラが自分の能力や効果によってリムーブされたとき、このキャラをリムーブエリアからスリープ状態で登場させてもよい。',
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/20-color-and-switch.md',
  ],
};

export const B05107: CardDef = {
  id: 'B05107',
  no: '0603/B05107',
  kind: 'character',
  names: ['ウォッカ'],
  colors: ['黒'],
  level: 7,
  ap: 6000,
  lp: 0,
  traits: ['黒ずくめの組織'],
  keywords: ['突撃'], // 〚突撃〛
  rarity: 'SR',
  imageUrl: '1745322246343553.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/20-color-and-switch.md',
  ],
};
