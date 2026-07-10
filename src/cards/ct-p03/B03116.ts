// cards/ct-p03/B03116 ウォッカ (character) — attribution mini-wave ① byPlayer:'self' (2026-07-10, engine変更0)
// rules: 03-field-areas.md, 09-cutin-disguise.md, 13-keywords.md, 15-abilities-effects.md, 17-icons.md, 20-color-and-switch.md, 22-qa-action-contact.md
//
// 公式テキスト:
//   【パートナー黒】【自分ターン中】自分の現場にいるこのキャラが自分の能力や効果によってリムーブされたとき、
//     このキャラをリムーブエリアからスリープ状態で登場させてもよい。そうした場合、カードを1枚引く。
//   【カットイン】AP＋1000（コンタクト中に手札からリムーブして使う）
//
// 句マッピング:
//   - 【パートナー黒】【自分ターン中】 => condition and[partnerColor 黒, turn self] (rules/17【パートナー(色)】【自分ターン中】)
//   - 自分の現場にいるこのキャラが自分の能力や効果によってリムーブされたとき
//       => trigger leave:to-remove + selfOnly (「このキャラ」= 除去された当人) +
//          matcherCondition removedCharMatches{cause:'effect', byPlayer:'self'}
//          (cause:'effect'= 「能力や効果によって」rules/17 / スイッチ非発火 は cause gate。
//           byPlayer:'self'= 「自分の」効果 owner 帰属、attribution mini-wave, cond/eval.ts:731。
//           Q&A「スイッチによるリムーブでは発動しない」= cause≠'effect' で二重遮断)
//   - このキャラをリムーブエリアからスリープ状態で登場させてもよい。そうした場合、カードを1枚引く。
//       => optional{ chain[ sceneEnter{from:remove, n:1, filter:{cardId:'B03116',kind:'character'}, enterSleep, viaEffect},
//                           draw{n:1} ] }
//          「してもよい」= optional wrapper (rules/15)。opt-in すると「登場させる」(定値 n:1) + 「そうした場合」draw。
//          filter cardId='B03116' = リムーブの「このキャラ」(同 cardId は同一カード扱い rules/02)。
//          Q&A「効果解決までにリムーブエリアを離れていた場合登場できず引けない」= filter 不一致で enter 空振り
//          → chain の draw も engine の atomic 解決では enter 成立時のみ到達 (共に optional 内)。
//          exemplar: sceneEnter from:remove + enterSleep + max/n 短縮形 = src/cards/ct-d05/D05006.ts a1 /
//                    optional{chain[...]} = D05006 a1 / removedCharMatches 消費 = src/cards/ct-d02/D02008.ts a2 /
//                    byPlayer gate = cond/eval.ts:731。
//   - 【カットイン】AP＋1000 => a2 icon-cutin (charModifyAP $contact.byUid +1000 scope contact)。
//                              exemplar: src/cards/ct-p03/B03129.ts a3。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  // 【パートナー黒】【自分ターン中】(state gate、rules/17)
  condition: {
    kind: 'and',
    cs: [
      { kind: 'partnerColor', color: '黒' },
      { kind: 'turn', player: 'self' },
    ],
  },
  trigger: {
    hook: 'leave:to-remove',
    selfOnly: true, // 「自分の現場にいるこのキャラが」= 除去された当人
    // 「自分の能力や効果によって」= cause:'effect' + 効果 owner 'self' 帰属
    matcherCondition: { kind: 'removedCharMatches', cause: 'effect', byPlayer: 'self' },
  },
  effect: {
    // 「登場させてもよい」= 任意 (rules/15)
    kind: 'optional',
    effect: {
      kind: 'chain',
      steps: [
        // このキャラをリムーブエリアからスリープ状態で登場 (定値 1体、同 cardId = このカード)
        {
          kind: 'atom',
          verb: 'sceneEnter',
          args: {
            player: 'self',
            from: 'remove',
            n: 1,
            viaEffect: true,
            enterSleep: true,
            filter: { cardId: 'B03116', kind: 'character' },
          },
        },
        // そうした場合、カードを1枚引く
        { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
      ],
    },
  },
  description:
    '【パートナー黒】【自分ターン中】自分の現場にいるこのキャラが自分の能力や効果によってリムーブされたとき、このキャラをリムーブエリアからスリープ状態で登場させてもよい。そうした場合、カードを1枚引く。',
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/20-color-and-switch.md',
  ],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-hand',
  trigger: { hook: 'effect:declared', optional: true, selfOnly: true }, // 【カットイン】(コンタクト中に手札から使用)
  effect: { kind: 'atom', verb: 'charModifyAP', args: { uid: '$contact.byUid', delta: 1000, scope: 'contact' } },
  description: '【カットイン】AP＋1000（コンタクト中に手札からリムーブして使う）',
  ruleRefs: ['rules/09-cutin-disguise.md', 'rules/22-qa-action-contact.md'],
};

export const B03116: CardDef = {
  id: 'B03116',
  no: '0365/B03116',
  kind: 'character',
  names: ['ウォッカ'],
  colors: ['黒'],
  level: 5,
  ap: 4000,
  lp: 0,
  traits: ['黒ずくめの組織'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1729133483012954.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/09-cutin-disguise.md',
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/20-color-and-switch.md',
    'rules/22-qa-action-contact.md',
  ],
};
