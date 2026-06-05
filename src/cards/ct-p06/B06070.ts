// cards/ct-p06/B06070 工藤有希子 (キャラ) — catalog-reuse batch
// rules: 03-field-areas.md, 10-action-event.md, 14-refresh.md, 15-abilities-effects.md, 17-icons.md
//
// 公式テキスト:
//   【絆工藤優作】【解決編】【登場時】カードを1枚引く。
//   [ヒラメキ欄] 【ヒラメキ】（証拠からリムーブされるときに発動する）キャラを1枚まで選び、スリープさせる。
//
// a1: 【絆工藤優作】【解決編】= condition and(bond, caseStatus 解決編) / 【登場時】= enter trigger → draw 1 (D08015 a1 同型)。
// a2: 【ヒラメキ】キャラを1枚まで選び、スリープさせる (D08019 / B01091 a2 同型 — $pick + 明示 target)。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  // 【絆工藤優作】【解決編】
  condition: {
    kind: 'and',
    cs: [
      { kind: 'bond', cardName: '工藤優作' },
      { kind: 'caseStatus', status: '解決編' },
    ],
  },
  // 【登場時】
  trigger: { hook: 'enter', selfOnly: true },
  // カードを1枚引く
  effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
  description: '【絆工藤優作】【解決編】【登場時】カードを1枚引く。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-evidence',
  // 【ヒラメキ】任意発動 (fire/skip)
  trigger: { hook: 'evidence:remove-by-action', optional: true },
  // キャラを1枚まで選び、スリープさせる
  // 注: hirameki fire 時に auto-pick されるよう明示 target ($pick + pick query) を保持 (D08019 a2 同型)。
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

export const B06070: CardDef = {
  id: 'B06070',
  no: '0691/B06070',
  kind: 'character',
  names: ['工藤有希子'],
  colors: ['白'],
  level: 3,
  ap: 3000,
  lp: 1,
  traits: ['女優'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1754285244518145.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/10-action-event.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
  ],
};
