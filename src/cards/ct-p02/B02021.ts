// cards/ct-p02/B02021 沖田総司 (キャラ) — engine-extension #3 batch (multi-target Pattern A)
// rules: 10-action-event.md, 15-abilities-effects.md, 17-icons.md, 19-special-rules.md, 21-declared-ability-cost.md
//
// 公式テキスト:
//   【宣言】【ターン1】相手の現場にいるキャラを5枚まで選び、ターン終了時までAP－1000する。
//   【ヒラメキ】（証拠からリムーブされるときに発動する）キャラを1枚まで選び、スリープさせる。
//
// a1: declared + turn1 limit, side:opp で max:5 の multi-target Pattern A.
//     apply-pick.ts (engine 拡張 #3) で 各 uid に charModifyAP -1000 を per-char 適用。
// a2: 【ヒラメキ】キャラを1枚までスリープ (D11009 a3 同型 inline)

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'declared',
  scope: 'on-scene',
  limit: { kind: 'turn', n: 1 }, // 【ターン1】
  // 相手の現場にいるキャラを 5 枚まで選び、ターン終了時まで AP-1000する
  // PA 短縮形 max:5 + side:'opp' + delta:-1000 + scope:'turn'。
  // engine-extension #3 で pickedUids 配列の各 uid に atom 適用される。
  effect: {
    kind: 'atom',
    verb: 'charModifyAP',
    args: { player: 'self', max: 5, side: 'opp', delta: -1000, scope: 'turn' },
  },
  description: '【宣言】【ターン1】相手の現場のキャラを5枚まで選び、ターン終了時までAP-1000。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/21-declared-ability-cost.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-evidence',
  trigger: { hook: 'evidence:remove-by-action', optional: true },
  effect: {
    kind: 'choice',
    chooser: 'self',
    options: [
      {
        kind: 'atom',
        verb: 'sceneSetState',
        args: { uid: '$pick', state: 'sleep', target: { kind: 'pick', query: { area: 'scene', side: 'either' }, n: { min: 0, max: 1 }, chooser: 'self' } },
      },
    ],
  },
  description: '【ヒラメキ】キャラを1枚まで選び、スリープさせる。',
  ruleRefs: ['rules/10-action-event.md', 'rules/03-field-areas.md'],
};

export const B02021: CardDef = {
  id: 'B02021',
  no: '0191/B02021',
  kind: 'character',
  names: ['沖田総司'],
  colors: ['緑'],
  level: 6,
  ap: 6000,
  lp: 0,
  traits: ['高校生'],
  keywords: [],
  rarity: 'R',
  imageUrl: '1721357188632949.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/10-action-event.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/19-special-rules.md',
    'rules/21-declared-ability-cost.md',
  ],
};
