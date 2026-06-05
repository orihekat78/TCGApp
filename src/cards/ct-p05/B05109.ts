// cards/ct-p05/B05109 キール (キャラ) — catalog-reuse batch
// rules: 10-action-event.md, 14-refresh.md, 15-abilities-effects.md, 17-icons.md
//
// 公式テキスト:
//   【パートナー黒】【解決編】【登場時】手札を1枚リムーブしてもよい。そうした場合、レベル6以下のキャラを1枚まで選び、リムーブする。
//   【ヒラメキ】（証拠からリムーブされるときに発動する）カードを1枚引く。
//
// a1: 【パートナー黒】【解決編】【登場時】chain (手札1リム max:1 → レベル6以下を1枚までリムーブ) (D08003 a1 同型)
// a2: 【ヒラメキ】カードを1枚引く (D08013 a2 同型)

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  // 【パートナー黒】【解決編】
  condition: { kind: 'and', cs: [{ kind: 'partnerColor', color: '黒' }, { kind: 'caseStatus', status: '解決編' }] },
  // 【登場時】
  trigger: { hook: 'enter', selfOnly: true },
  effect: {
    kind: 'chain',
    steps: [
      // 手札を1枚リムーブしてもよい (max:1 で skip 可能、skip 時は chain break)
      { kind: 'atom', verb: 'discard',     args: { player: 'self', max: 1 } },
      // そうした場合、レベル6以下のキャラを1枚まで選び、リムーブする
      { kind: 'atom', verb: 'sceneRemove', args: { player: 'self', max: 1, side: 'either', filter: { levelMax: 6 } } },
    ],
  },
  description: '【パートナー黒】【解決編】【登場時】手札を1枚リムーブしてもよい。そうした場合 レベル6以下を1枚までリムーブ。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

// a2: 【ヒラメキ】カードを1枚引く (D08013 a2 同型)
const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-evidence',
  trigger: { hook: 'evidence:remove-by-action', optional: true }, // 任意発動
  // カードを1枚引く
  effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
  description: '【ヒラメキ】カードを1枚引く。',
  ruleRefs: ['rules/10-action-event.md', 'rules/14-refresh.md'],
};

export const B05109: CardDef = {
  id: 'B05109',
  no: '0605/B05109',
  kind: 'character',
  names: ['キール'],
  colors: ['黒'],
  level: 6,
  ap: 5000,
  lp: 1,
  traits: ['黒ずくめの組織'],
  keywords: [],
  rarity: 'R',
  imageUrl: '1746628078754546.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/10-action-event.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
  ],
};
