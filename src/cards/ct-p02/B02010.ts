// cards/ct-p02/B02010 灰原哀 (キャラ) — catalog-reuse batch
// rules: 10-action-event.md, 14-refresh.md, 15-abilities-effects.md, 17-icons.md, 20-color-and-switch.md, 21-declared-ability-cost.md
//
// 公式テキスト:
//   【宣言】【ターン1】【青】以外の色を持つキャラを1枚まで選び、ターン終了時までAP＋2000する。
//   【ヒラメキ】（証拠からリムーブされるときに発動する）カードを1枚引く。
//
// a1: 【宣言】【ターン1】(cost なし) → 【青】以外の色を持つキャラを1枚まで選び AP＋2000 (ターン終了まで)
//     「【青】以外の色を持つ」= 青 を含まない色構成 → TargetFilter.custom で colors.includes('青')===false を判定 (D11005 同型 engine read)。
// a2: 【ヒラメキ】(evidence:remove-by-action optional) → 1ドロー — D08013 a2 同型

import type { AbilityDef, CardDef, GameState } from '@/engine/types';
import type { Candidate } from '@/engine/types';
import { engine } from '@/engine';

const a1: AbilityDef = {
  id: 'a1',
  type: 'declared',
  scope: 'on-scene',
  limit: { kind: 'turn', n: 1 },
  // 【青】以外の色を持つキャラを1枚まで選び、ターン終了時までAP＋2000する (青 を含まないキャラに限定)
  effect: {
    kind: 'atom',
    verb: 'charModifyAP',
    args: {
      delta: 2000,
      max: 1,
      side: 'either',
      scope: 'turn',
      filter: {
        custom: (_s: GameState, cand: Candidate) => {
          if (cand.kind !== 'char') return false;
          const def = engine.cards.get(cand.cardId);
          return !!def && !def.colors.includes('青');
        },
      },
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
