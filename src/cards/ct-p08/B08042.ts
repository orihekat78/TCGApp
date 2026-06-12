// cards/ct-p08/B08042 メデューサ (キャラ) — engine-extension #1 leave:to-remove batch #2
// rules: 15-abilities-effects.md, 17-icons.md, 24-qa-naming-stun.md
//
// 公式テキスト:
//   【相手ターン中】【現場リムーブ時】スリープ状態のキャラを1枚まで選び、スタンさせる。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'leave:to-remove', selfOnly: true },
  condition: { kind: 'turn', player: 'opp' },
  effect: {
    kind: 'atom',
    verb: 'sceneSetState',
    args: {
      uid: '$pick',
      state: 'stun',
      target: {
        kind: 'pick',
        query: { area: 'scene', side: 'either', state: ['sleep'] },
        n: { min: 0, max: 1 },
        chooser: 'self',
      },
    },
  },
  description: '【相手ターン中】【現場リムーブ時】スリープキャラを1枚までスタン。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/24-qa-naming-stun.md'],
};

// a2: 【ヒラメキ】キャラを1枚まで選びスリープ (BUG-140 補修 2026-06-13) — D05007 a2 同型
// (明示 $pick+target: hirameki fire は hiramekiResolve が chooseAtomTarget で auto-resolve するため短縮形不可)
const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-evidence',
  trigger: { hook: 'evidence:remove-by-action', optional: true },
  effect: {
    kind: 'atom',
    verb: 'sceneSetState',
    args: {
      uid: '$pick',
      state: 'sleep',
      target: { kind: 'pick', query: { area: 'scene', side: 'either' }, n: { min: 0, max: 1 }, chooser: 'self' },
    },
  },
  description: '【ヒラメキ】（証拠からリムーブされるときに発動する）キャラを1枚まで選び、スリープさせる。',
  ruleRefs: ['rules/10-action-event.md', 'rules/03-field-areas.md'],
};

export const B08042: CardDef = {
  id: 'B08042',
  no: '0881/B08042',
  kind: 'character',
  names: ['メデューサ'],
  colors: ['白'],
  level: 5, ap: 4000, lp: 1,
  traits: ['女優', '怪物'], keywords: [],
  rarity: 'C',
  imageUrl: '1770731222607411.jpg',
  abilities: [a1, a2],
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md'],
};
