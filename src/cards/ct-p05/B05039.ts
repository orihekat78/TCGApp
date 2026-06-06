// cards/ct-p05/B05039 松田左文字 (キャラ) — engine-extension reasoning-hook batch #3 (2026-06-06 タスクC)
// rules: 11-reasoning.md, 15-abilities-effects.md, 17-icons.md, 19-special-rules.md
//
// 公式テキスト:
//   このキャラが推理したとき、レベル5のキャラを2枚までと、レベル7のキャラを1枚まで選び、
//     ターン終了時までAP＋1000する。
//
// a1: 推理反応 (reasoning:end selfOnly = このキャラが推理したとき、source.uid 一致)。
//   効果は 2 段の multi-target pick を sequence で連結:
//     1) レベル5のキャラを2枚まで (どちらの現場でも = side:'either', rules/15) → AP+1000 turn
//     2) レベル7のキャラを1枚まで (どちらの現場でも) → AP+1000 turn
//   いずれも charModifyAP PA 短縮形 (uid 不在 + delta + max)。multi-target は apply-pick が
//   pickedUids 各 uid に per-char 適用 (B02021 沖田総司 同型)。exact level = levelMin==levelMax。
//   「〜枚まで」= max 形 (n.min=0、0 枚選択可、rules/15)。【ターンN】記載なし → limit 不要。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  // このキャラが推理したとき (reasoning:end selfOnly = source.uid 一致でこのキャラ自身の推理のみ発火)
  trigger: { hook: 'reasoning:end', selfOnly: true },
  effect: {
    kind: 'sequence',
    steps: [
      // レベル5のキャラを2枚まで (どちらの現場でも選べる, rules/15)、ターン終了時まで AP+1000
      {
        kind: 'atom',
        verb: 'charModifyAP',
        args: { player: 'self', max: 2, side: 'either', delta: 1000, scope: 'turn', filter: { levelMin: 5, levelMax: 5 } },
      },
      // レベル7のキャラを1枚まで (どちらの現場でも選べる)、ターン終了時まで AP+1000
      {
        kind: 'atom',
        verb: 'charModifyAP',
        args: { player: 'self', max: 1, side: 'either', delta: 1000, scope: 'turn', filter: { levelMin: 7, levelMax: 7 } },
      },
    ],
  },
  description:
    'このキャラが推理したとき、レベル5のキャラを2枚までとレベル7のキャラを1枚まで選び、ターン終了時までAP+1000する。',
  ruleRefs: ['rules/11-reasoning.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/19-special-rules.md'],
};

export const B05039: CardDef = {
  id: 'B05039',
  no: '0543/B05039',
  kind: 'character',
  names: ['松田左文字'],
  colors: ['緑'],
  level: 4,
  ap: 3000,
  lp: 1,
  traits: ['探偵'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1746628061763739.jpg',
  abilities: [a1],
  ruleRefs: ['rules/11-reasoning.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/19-special-rules.md'],
};
