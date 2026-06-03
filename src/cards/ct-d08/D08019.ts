// cards/ct-d08/D08019 阿笠博士 (キャラ)
// rules: 03-field-areas.md, 10-action-event.md, 15-abilities-effects.md, 17-icons.md, 24-qa-naming-stun.md
// spec: .claude/specs/cards-analysis/D08019.md
//
// 公式テキスト:
//   【解決編】【登場時】自分の現場に〚特徴［少年探偵団］〛のキャラがいる場合、
//     キャラを1枚まで選び、スリープさせる。
//   【ヒラメキ】キャラを1枚まで選び、スリープさせる。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  condition: { kind: 'caseStatus', status: '解決編' },
  trigger: { hook: 'enter', selfOnly: true },
  effect: {
    kind: 'conditional',
    // 自分の現場に[少年探偵団]のキャラがいる場合
    if: { kind: 'sceneHas', query: { area: 'scene', side: 'self', filter: { trait: '少年探偵団' } }, nMin: 1 },
    // キャラを1枚まで選び、スリープさせる
    then: { kind: 'atom', verb: 'sceneSetState', args: { player: 'self', max: 1, side: 'either', state: 'sleep' } },
  },
  description:
    '【解決編】【登場時】自分の現場に[少年探偵団]がいる場合、キャラを1枚までスリープ。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

// a2: 【ヒラメキ】キャラを1枚まで選び、スリープさせる (旧 hiramekiCharStun factory を inline + sceneSetState 短縮形)
const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-evidence',
  trigger: { hook: 'evidence:remove-by-action', optional: true }, // 任意発動
  // キャラを1枚まで選び、スリープさせる
  // 注: hirameki fire は hiramekiResolve handler が chooseAtomTarget で $pick を自動解決するため、
  //     明示 target ($pick + pick query) を保持する (sceneSetState 短縮形だと fire 時 auto-pick されず side-channel 待ちになる)。
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

export const D08019: CardDef = {
  id: 'D08019',
  no: '0497/D08019',
  kind: 'character',
  names: ['阿笠博士'],
  colors: ['青'],
  level: 5,
  ap: 5000,
  lp: 1,
  traits: ['発明家'],
  keywords: [],
  rarity: 'D',
  imageUrl: '1743743093512121.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/10-action-event.md',
    'rules/17-icons.md',
  ],
};
