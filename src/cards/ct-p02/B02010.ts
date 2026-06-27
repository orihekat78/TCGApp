// cards/ct-p02/B02010 灰原哀 (キャラ) — catalog-reuse batch
// rules: 10-action-event.md, 14-refresh.md, 15-abilities-effects.md, 17-icons.md, 20-color-and-switch.md, 21-declared-ability-cost.md
//
// 公式テキスト:
//   【宣言】【ターン1】【青】以外の色を持つキャラを1枚まで選び、ターン終了時までAP＋2000する。
//   【ヒラメキ】（証拠からリムーブされるときに発動する）カードを1枚引く。
//
// a1: 【宣言】【ターン1】(cost なし) → 【青】以外の色を持つキャラを1枚まで選び AP＋2000 (ターン終了まで)
//     「【青】以外の色を持つ」= some説 (公式 B08079: 2色{青,X}も「青以外の色を持つ」を満たす) → TargetFilter.colorNot:'青'
//     (2026-06-27 engine 追加)。旧 custom closure `!colors.includes('青')` は none説で 2色対象を誤除外していた (BUG-159 修正)。
// a2: 【ヒラメキ】(evidence:remove-by-action optional) → 1ドロー — D08013 a2 同型

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'declared',
  scope: 'on-scene',
  limit: { kind: 'turn', n: 1 },
  // 【青】以外の色を持つキャラを1枚まで選び、ターン終了時までAP＋2000する (青以外の色を1つ以上持つ = some説)
  effect: {
    kind: 'atom',
    verb: 'charModifyAP',
    args: {
      delta: 2000,
      max: 1,
      side: 'either',
      scope: 'turn',
      filter: { colorNot: '青' },
    },
  },
  description: '【宣言】【ターン1】[青]以外の色を持つキャラを1枚まで選び、ターン終了時までAP＋2000。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/20-color-and-switch.md', 'rules/21-declared-ability-cost.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-evidence',
  trigger: { hook: 'evidence:remove-by-action', optional: true },
  // カードを1枚引く
  effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
  description: '【ヒラメキ】カードを1枚引く。',
  ruleRefs: ['rules/10-action-event.md', 'rules/14-refresh.md'],
};

export const B02010: CardDef = {
  id: 'B02010',
  no: '0182/B02010',
  kind: 'character',
  names: ['灰原哀'],
  colors: ['青'],
  level: 6,
  ap: 5000,
  lp: 1,
  traits: ['少年探偵団', '科学者'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1721357158852508.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/10-action-event.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/20-color-and-switch.md',
    'rules/21-declared-ability-cost.md',
  ],
};
