// cards/ct-p09/B09060 沖矢昴 (character) — attribution mini-wave ② costPaid (removeFromHand hand-source → costRemovedMatches key)
// rules: 03-field-areas.md, 10-action-event.md, 13-keywords.md, 15-abilities-effects.md, 17-icons.md, 21-declared-ability-cost.md
//
// 公式テキスト:
//   【FILE7】【宣言】【ターン1】〚手札からキャラを1枚リムーブする〛：この【宣言】能力のコストによって〚特徴［FBI］〛の
//   キャラをリムーブした場合、ターン終了時までこのキャラをAP＋1000し、〚突撃［事件］〛を持つ。この【宣言】能力のコスト
//   によって〚特徴［赤井家］〛のキャラをリムーブした場合、ターン終了時までこのキャラをAP＋1000し、〚突撃［キャラ］〛を持つ。
//   【ヒラメキ】自分のリムーブエリアにある〚カード名［赤井秀一］〛を1枚まで選び、手札に加える。
//
// 句マッピング:
//   - 【FILE7】 => condition fileAtLeast{n:7} (B09010/B09038 同型。アシスト中パートナーも数える rules/17。Q&A 明記)
//   - 【宣言】【ターン1】〚手札からキャラを1枚リムーブする〛 => type:'declared' + limit{turn,1} +
//       cost pay[removeFromHand{target pick hand self filter{kind:'character'} n{1,1} chooser self, n:1}]
//       (D02013 removeFromHand cost + BUG-123 hand char pick は kind:'character'。
//        pay が ctx.costPaid['removeFromHand']={ids, level} を記録、cost/pay.ts:104-105。ids を下記 cond が読む)
//   - コストによって〚特徴［FBI］〛のキャラをリムーブした場合、…AP＋1000し、〚突撃［事件］〛を持つ =>
//       conditional if costRemovedMatches{key:'removeFromHand', filter:{trait:'FBI'}}
//         then sequence[charModifyAP{uid:'$self',delta:1000,scope:'turn'}, charGrantKeyword{uid:'$self',kw:'突撃[事件]',scope:'turn'}]
//       (costRemovedMatches key:'removeFromHand' = hand-source 記録参照、cond/eval.ts:337 attribution mini-wave。
//        B03003 は key 無=removeDeckTop。charModifyAP/charGrantKeyword uid:'$self' scope:'turn' は D09025/D10007/PR187 同型。
//        突撃[事件] kw grounding = PR187 a1)
//   - コストによって〚特徴［赤井家］〛のキャラをリムーブした場合、…AP＋1000し、〚突撃［キャラ］〛を持つ =>
//       第2 conditional (FBI branch と独立、2本並列)。Q&A「両方の特徴を持つキャラをリムーブ→AP+2000し突撃[事件]と
//       突撃[キャラ]両方」= 2 conditional が独立成立 → 両方 true で AP+1000 が2回 (計+2000) + 両 kw 付与 (rules/15 同時発動)
//   - 【ヒラメキ】自分のリムーブエリアにある〚カード名［赤井秀一］〛を1枚まで選び、手札に加える =>
//       a2 triggered on-evidence, hook evidence:remove-by-action optional,
//       handAddFromRemove{player:'self', max:1, filter:{cardName:'赤井秀一'}} (D10020 a2 / B06078 a2 同型ヒラメキ)

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'declared',
  scope: 'on-scene',
  condition: { kind: 'fileAtLeast', n: 7 }, // 【FILE7】(アシスト中パートナーも数える rules/17)
  limit: { kind: 'turn', n: 1 }, // 【ターン1】
  cost: {
    kind: 'removeFromHand',
    target: {
      kind: 'pick',
      query: { area: 'hand', side: 'self', filter: { kind: 'character' } },
      n: { min: 1, max: 1 },
      chooser: 'self',
    },
    n: 1,
  },
  effect: {
    kind: 'sequence',
    steps: [
      // コストで〚特徴[FBI]〛をリムーブ → AP+1000 + 突撃[事件] (ターン終了時まで)
      {
        kind: 'conditional',
        if: { kind: 'costRemovedMatches', key: 'removeFromHand', filter: { trait: 'FBI' } },
        then: {
          kind: 'sequence',
          steps: [
            { kind: 'atom', verb: 'charModifyAP', args: { uid: '$self', delta: 1000, scope: 'turn' } },
            { kind: 'atom', verb: 'charGrantKeyword', args: { uid: '$self', kw: '突撃[事件]', scope: 'turn' } },
          ],
        },
      },
      // コストで〚特徴[赤井家]〛をリムーブ → AP+1000 + 突撃[キャラ] (FBI branch と独立、両立可 公式Q&A)
      {
        kind: 'conditional',
        if: { kind: 'costRemovedMatches', key: 'removeFromHand', filter: { trait: '赤井家' } },
        then: {
          kind: 'sequence',
          steps: [
            { kind: 'atom', verb: 'charModifyAP', args: { uid: '$self', delta: 1000, scope: 'turn' } },
            { kind: 'atom', verb: 'charGrantKeyword', args: { uid: '$self', kw: '突撃[キャラ]', scope: 'turn' } },
          ],
        },
      },
    ],
  },
  description:
    '【FILE7】【宣言】【ターン1】〚手札からキャラを1枚リムーブする〛：この【宣言】能力のコストによって〚特徴［FBI］〛のキャラをリムーブした場合、ターン終了時までこのキャラをAP＋1000し、〚突撃［事件］〛を持つ。この【宣言】能力のコストによって〚特徴［赤井家］〛のキャラをリムーブした場合、ターン終了時までこのキャラをAP＋1000し、〚突撃［キャラ］〛を持つ。',
  ruleRefs: [
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md',
  ],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-evidence',
  trigger: { hook: 'evidence:remove-by-action', optional: true },
  effect: {
    kind: 'atom',
    verb: 'handAddFromRemove',
    args: { player: 'self', max: 1, filter: { cardName: '赤井秀一' } },
  },
  description: '【ヒラメキ】自分のリムーブエリアにある〚カード名［赤井秀一］〛を1枚まで選び、手札に加える。',
  ruleRefs: ['rules/10-action-event.md', 'rules/14-refresh.md'],
};

export const B09060: CardDef = {
  id: 'B09060',
  no: '1002/B09060',
  kind: 'character',
  names: ['沖矢昴'],
  colors: ['赤'],
  level: 4,
  ap: 4000,
  lp: 1,
  traits: ['大学院生'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1775608872824770.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/10-action-event.md',
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md',
  ],
};
