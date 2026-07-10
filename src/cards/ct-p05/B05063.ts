// cards/ct-p05/B05063 園子のアブない夏物語 (事件) — M2後半 batch (2026-07-10, toHandOnTurnEnd first-consumer)
// rules: 01-victory-conditions.md, 15-abilities-effects.md, 17-icons.md, 21-declared-ability-cost.md, 23-qa-disguise-cutin.md
// grounding: .claude/specs/grounding/B05063.md
//
// 公式テキスト:
//   この事件が解決編になったとき、自分は手札を1枚リムーブする。
//   【解決編】【宣言】【ターン1】〚裏向きの証拠を3つ表向きにする〛：手札からレベル8以下の
//   〚カード名［京極真］〛のキャラを1枚まで登場させる。ターン終了時までそのキャラに
//   「ターン終了時、このキャラを現場から手札に移す。」を与える。この能力は自分の現場に
//   〚特徴［鈴木財閥］〛のキャラが3枚以上いる場合に宣言できる。
//
// 句マッピング:
//   a1 = _shared/caseResolvedHandRemove({n:1}) — D06019/D09027/B05024 同型 (case:to-resolved hook,
//        scope 'always'、事件カードは case area 所在)。
//   a2 (declared, scope 'always' — B05024/D08026 同 rationale):
//     - 【解決編】+「鈴木財閥 3枚以上」=> condition and[caseStatus:解決編, sceneHas nMin:3]
//       (sceneHas は現場列挙の枚数計数 cond/eval.ts)。
//     - 〚裏向きの証拠を3つ表向きにする〛=> cost flipFaceUpEvidence n:{min:3,max:3}
//       (B05024/D09027 と byte 同型。公式Q&A: 裏証拠2つ以下では使用不可 = canPay 裏向き≥n.min /
//        コストは自分の証拠のみ rules/21)。
//     - 「手札からレベル8以下の[京極真]を1枚まで登場」=> sceneEnter from:'hand' 短縮形 +
//       bind:'$entered' (scene.ts 単一 path bind)。「1枚まで」= 0枚可 (rules/15)。
//       【宣言】効果による登場 = 色制限外 (rules/20)。効果登場でも【登場時】発動 (BUG-146)。
//     - 「ターン終了時、このキャラを現場から手札に移す。」=> charSetTurnEffect
//       {uid:'$entered.uid', key:'toHandOnTurnEnd'} (B07079 a2 toDeckBottomOnTurnEnd rider 同型)。
//       endTurn consume = flow/turn.ts (M2後半で追加、scene.toHand — リムーブでない →
//       【現場リムーブ時】不発動)。公式Q&A: 変装先に引き継がれる = turnEffects 自動引継ぎ (rules/23)。

import type { AbilityDef, CardDef } from '@/engine/types';
import { caseResolvedHandRemove } from '@/cards/_shared';

// a1: この事件が解決編になったとき、自分は手札を1枚リムーブする。
const a1 = caseResolvedHandRemove({ n: 1, abilityId: 'a1' });

// a2: 【解決編】【宣言】【ターン1】〚裏向きの証拠を3つ表向きにする〛
const a2: AbilityDef = {
  id: 'a2',
  type: 'declared',
  scope: 'always',
  condition: {
    kind: 'and',
    cs: [
      { kind: 'caseStatus', status: '解決編' },
      // 「自分の現場に〚特徴［鈴木財閥］〛のキャラが3枚以上いる場合に宣言できる」
      { kind: 'sceneHas', query: { area: 'scene', side: 'self', filter: { trait: '鈴木財閥', kind: 'character' } }, nMin: 3 },
    ],
  },
  limit: { kind: 'turn', n: 1 },
  cost: { kind: 'flipFaceUpEvidence', n: { min: 3, max: 3 } },
  effect: {
    kind: 'sequence',
    steps: [
      // 手札からレベル8以下の[京極真]のキャラを1枚まで登場させる (短縮形 + bind:'$entered')
      {
        kind: 'atom',
        verb: 'sceneEnter',
        args: {
          player: 'self',
          from: 'hand',
          // side:'self' 明示: PA 短縮形は buildShortFormPick(from, a, seP0, seP0) が解決済み絶対 player を
          // side literal に流すため、owner=opp の宣言で side が二重解決される (cross-side 短縮形 latent)。
          // 明示 'self' は owner 相対で正しく解決される (「手札から」= 自分の手札、意味等価)。
          side: 'self',
          max: 1,
          viaEffect: true,
          filter: { cardName: '京極真', levelMax: 8, kind: 'character' },
          bind: '$entered',
        },
      },
      // ターン終了時までそのキャラに「ターン終了時、このキャラを現場から手札に移す。」を与える
      { kind: 'atom', verb: 'charSetTurnEffect', args: { uid: '$entered.uid', key: 'toHandOnTurnEnd', val: true } },
    ],
  },
  description:
    '【解決編】【宣言】【ターン1】〚裏向きの証拠を3つ表向きにする〛：手札からレベル8以下の〚カード名［京極真］〛のキャラを1枚まで登場させる。ターン終了時までそのキャラに「ターン終了時、このキャラを現場から手札に移す。」を与える。この能力は自分の現場に〚特徴［鈴木財閥］〛のキャラが3枚以上いる場合に宣言できる。',
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md',
    'rules/23-qa-disguise-cutin.md',
  ],
};

export const B05063: CardDef = {
  id: 'B05063',
  no: '0565/B05063',
  kind: 'case',
  names: ['園子のアブない夏物語'],
  colors: ['白'],
  traits: [],
  rarity: 'C',
  imageUrl: '1745322205558901.jpg',
  caseLevel: 7,
  caseTraits: [],
  abilities: [a1, a2],
  ruleRefs: [
    'rules/01-victory-conditions.md',
    'rules/15-abilities-effects.md',
    'rules/21-declared-ability-cost.md',
  ],
};
