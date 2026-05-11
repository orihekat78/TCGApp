// cards/ct-d08/D08013 吉田歩美 (キャラ)
// rules: 10-action-event.md, 14-refresh.md, 15-abilities-effects.md, 17-icons.md
// spec: .claude/specs/cards-analysis/D08013.md
//
// 公式テキスト:
//   【登場時】証拠を1つ得る。自分の証拠を1つ選び、手札に加える。自分は手札を1枚リムーブする。
//   【ヒラメキ】カードを1枚引く。
//
// a1: enter trigger → 証拠+1 → 選択証拠を手札へ → 手札1枚リム
// a2: hiramekiDraw

import type { AbilityDef, CardDef } from '@/engine/types';
import { hiramekiDraw } from '../_shared/index.js';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'enter', selfOnly: true },
  effect: {
    kind: 'sequence',
    steps: [
      { kind: 'atom', verb: 'evidenceGain', args: { player: 'self', n: 1 } },
      {
        kind: 'choice',
        chooser: 'self',
        options: [
          {
            kind: 'atom',
            verb: 'evidenceToHand',
            args: {
              player: 'self',
              target: {
                kind: 'pick',
                query: { area: 'evidence', side: 'self' },
                n: { min: 1, max: 1 },
                chooser: 'self',
              },
            },
          },
        ],
      },
      {
        kind: 'choice',
        chooser: 'self',
        options: [
          {
            kind: 'atom',
            verb: 'discard',
            args: {
              player: 'self',
              target: {
                kind: 'pick',
                query: { area: 'hand', side: 'self' },
                n: { min: 1, max: 1 },
                chooser: 'self',
              },
            },
          },
        ],
      },
    ],
  },
  description:
    '【登場時】証拠を1つ得る。自分の証拠を1つ選び、手札に加える。自分は手札を1枚リムーブする。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

export const D08013: CardDef = {
  id: 'D08013',
  no: '0494/D08013',
  kind: 'character',
  names: ['吉田歩美'],
  colors: ['青'],
  level: 4,
  ap: 4000,
  lp: 1,
  traits: ['少年探偵団'],
  keywords: [],
  rarity: 'D',
  imageUrl: '1743743093483205.jpg',
  abilities: [a1, hiramekiDraw({ n: 1, abilityId: 'a2' })],
  ruleRefs: [
    'rules/10-action-event.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
  ],
};
