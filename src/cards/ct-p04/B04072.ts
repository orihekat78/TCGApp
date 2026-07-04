// cards/ct-p04/B04072 白鳥任三郎 (character) — CARD PHASE step12 (untargetableByActionAura 初 consumer、engine変更0)
// rules: rules/03-field-areas.md, rules/07-action-flow.md, rules/15-abilities-effects.md,
//        rules/17-icons.md, rules/21-declared-ability-cost.md, rules/24-qa-naming-stun.md
//
// 公式テキスト:
//   このキャラがスリープ状態の場合、相手は自分の現場にいるレベル5以下の【青】とレベル5以下の【黄】の
//   キャラを指定してアクションできない。
//   【宣言】【スリープ】：キャラを1枚まで選び、ターン終了時までAP＋2000する。
//
// 句マッピング:
//   - 「このキャラがスリープ状態の場合」=> continuous ability.condition charStateIs{ref:self, state:'sleep'}
//     (rules/24 常時有効型 = 条件成立中のみ効果あり)。公式Q&A「スタン状態の場合は有効ではありません」=
//     charStateIs は === 単一比較 (cond/eval.ts) で stun ≠ sleep → 自動整合。
//   - 「相手は自分の現場にいるレベル5以下の【青】とレベル5以下の【黄】のキャラを指定してアクション
//     できない」=> continuousModifier.untargetableByActionAura: {levelMax:5, color:['青','黄']}
//     (engine mega-wave W6 step5 r50 — read/char.ts auraUntargetableByAction が bearer 同 side scene を
//     walk し ability.condition honor、消費 = target-expander.candidates() 負 filter)。
//     「レベル5以下の【青】とレベル5以下の【黄】」= levelMax 両枝共通 AND + color 配列 any-match OR
//     (candidates.ts color 配列 = any-match) で意味論一致。
//     公式Q&A「ガードすることはできますか？→はい」= guard 経路は candidates() 非経由 → 自動整合。
//   - 【宣言】【スリープ】=> type:'declared' + cost:{kind:'sleepSelf'} (B04031 a1 同型)。
//   - 「キャラを1枚まで選び、ターン終了時までAP＋2000する」=> charModifyAP 短縮形 pick
//     {max:1, side:'either', delta:2000, scope:'turn'} (D01006 VERBATIM 同型、delta 差のみ。
//     エリア指定なし「キャラ」= side:'either' rules/15、「1枚まで」= 0枚可)。
import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'continuous',
  scope: 'on-scene',
  condition: { kind: 'charStateIs', ref: { kind: 'self' }, state: 'sleep' },
  continuousModifier: {
    untargetableByActionAura: { levelMax: 5, color: ['青', '黄'] },
  },
  description:
    'このキャラがスリープ状態の場合、相手は自分の現場にいるレベル5以下の【青】とレベル5以下の【黄】のキャラを指定してアクションできない。',
  ruleRefs: ['rules/03-field-areas.md', 'rules/07-action-flow.md', 'rules/24-qa-naming-stun.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'declared',
  scope: 'on-scene',
  cost: { kind: 'sleepSelf' },
  effect: {
    kind: 'atom',
    verb: 'charModifyAP',
    args: { max: 1, side: 'either', delta: 2000, scope: 'turn' },
  },
  description: '【宣言】【スリープ】：キャラを1枚まで選び、ターン終了時までAP＋2000する。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/21-declared-ability-cost.md'],
};

export const B04072: CardDef = {
  id: 'B04072',
  no: '0458/B04072',
  kind: 'character',
  names: ['白鳥任三郎'],
  colors: ['黄'],
  level: 6,
  ap: 6000,
  lp: 1,
  traits: ['警察', '警視庁'],
  rarity: 'R',
  imageUrl: '1735287822607291.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/07-action-flow.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md',
    'rules/24-qa-naming-stun.md',
  ],
};
