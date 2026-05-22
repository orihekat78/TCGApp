// cards/ct-d08/D08015 小嶋元太 (キャラ)
// rules: 09-cutin-disguise.md, 14-refresh.md, 15-abilities-effects.md, 17-icons.md
// spec: .claude/specs/cards-analysis/D08015-workflow.md
//
// 公式テキスト:
//   【登場時】カードを1枚引き、手札を1枚リムーブする。
//   【カットイン】AP＋1000
//
// a1: enter trigger → 1ドロー → 手札1リム
// a2: cutinFixedAP({ delta:1000 })

import type { AbilityDef, CardDef } from '@/engine/types';
import { cutinFixedAP } from '../_shared/index.js';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'enter', selfOnly: true },
  effect: {
    kind: 'sequence',
    steps: [
      { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
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
  description: '【登場時】カードを1枚引き、手札を1枚リムーブする。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

export const D08015: CardDef = {
  id: 'D08015',
  no: '0495/D08015',
  kind: 'character',
  names: ['小嶋元太'],
  colors: ['青'],
  level: 3,
  ap: 2000,
  lp: 1,
  traits: ['少年探偵団'],
  keywords: [],
  rarity: 'D',
  imageUrl: '1743743093493248.jpg',
  abilities: [a1, cutinFixedAP({ delta: 1000, abilityId: 'a2' })],
  ruleRefs: [
    'rules/09-cutin-disguise.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
  ],
};
