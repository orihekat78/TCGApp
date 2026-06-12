// cards/ct-d03/D03004 怪盗キッド (キャラ) — engine-extension #1 leave:to-remove batch #2
// rules: 15-abilities-effects.md, 17-icons.md, 24-qa-naming-stun.md
//
// 公式テキスト:
//   【相手ターン中】【現場リムーブ時】レベル5以下のスリープ状態のキャラを1枚まで選び、スタンさせる。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'leave:to-remove', selfOnly: true },
  condition: { kind: 'turn', player: 'opp' },
  // PA短縮形は state=新状態 / state[]=候補filter の二重用途。長形で書く:
  // uid='$pick' + state:'stun' (新状態) + target.query.state:['sleep'] (filter)
  effect: {
    kind: 'atom',
    verb: 'sceneSetState',
    args: {
      uid: '$pick',
      state: 'stun',
      target: {
        kind: 'pick',
        query: { area: 'scene', side: 'either', filter: { levelMax: 5 }, state: ['sleep'] },
        n: { min: 0, max: 1 },
        chooser: 'self',
      },
    },
  },
  description: '【相手ターン中】【現場リムーブ時】レベル5以下のスリープキャラを1枚までスタン。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/24-qa-naming-stun.md'],
};

// a2: 【ヒラメキ】カードを1枚引く (BUG-140 補修 2026-06-13: TSV hirameki 列の取りこぼし修正) — D03011 a2 同型
const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-evidence',
  trigger: { hook: 'evidence:remove-by-action', optional: true },
  // カードを1枚引く
  effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
  description: '【ヒラメキ】（証拠からリムーブされるときに発動する）カードを1枚引く。',
  ruleRefs: ['rules/10-action-event.md', 'rules/14-refresh.md'],
};

export const D03004: CardDef = {
  id: 'D03004',
  no: '0121/D03004',
  kind: 'character',
  names: ['怪盗キッド'],
  colors: ['白'],
  level: 4, ap: 4000, lp: 1,
  traits: ['怪盗'], keywords: [],
  rarity: 'D',
  imageUrl: '1714013117404423.jpg',
  abilities: [a1, a2],
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md'],
};
