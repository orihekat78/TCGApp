// cards/ct-d08/D08019 阿笠博士 (キャラ)
// rules: 03-field-areas.md, 10-action-event.md, 15-abilities-effects.md, 17-icons.md, 24-qa-naming-stun.md
// spec: .claude/specs/cards-analysis/D08019.md
//
// 公式テキスト:
//   【解決編】【登場時】自分の現場に〚特徴［少年探偵団］〛のキャラがいる場合、
//     キャラを1枚まで選び、スリープさせる。
//   【ヒラメキ】キャラを1枚まで選び、スリープさせる。

import type { AbilityDef, CardDef } from '@/engine/types';
import { hiramekiCharStun } from '../_shared/index.js';

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
  abilities: [a1, hiramekiCharStun({ side: 'either', abilityId: 'a2' })],
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/10-action-event.md',
    'rules/17-icons.md',
  ],
};
