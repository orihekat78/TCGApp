// cards/ct-p01/B01011 江戸川コナン (キャラ) — Task A batch#2 (engine変更0) A.enter+hirameki クラスタ
// rules: 03-field-areas.md, 05-turn-phases.md, 10-action-event.md, 14-refresh.md, 15-abilities-effects.md, 17-icons.md
//
// 公式テキスト:
//   このキャラはスリープ状態で登場する。
//   【ヒラメキ】（証拠からリムーブされるときに発動する）カードを1枚引く。
//
// 「このキャラはスリープ状態で登場する。」= CardDef.entersSleep:true。
// mutate.scene.enter が enter hook より前に sleep で生成し、通常プレイ / ネクストヒント /
// 効果登場の全経路で一時的な active 状態を公開しない。
// a2: 【ヒラメキ】1ドロー (D08013 a2 同型 hirameki draw)。

import type { AbilityDef, CardDef } from '@/engine/types';

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

export const B01011: CardDef = {
  id: 'B01011',
  no: '0007/B01011',
  kind: 'character',
  names: ['江戸川コナン'],
  colors: ['青'],
  level: 4,
  ap: 2000,
  lp: 2,
  entersSleep: true,
  traits: ['探偵', '毛利探偵事務所', '少年探偵団'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1714012985492767.jpg',
  abilities: [a2],
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/05-turn-phases.md',
    'rules/10-action-event.md',
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
  ],
};
