// cards/ct-p02/B02020P 大岡紅葉 (パラレル) — B02020 と同型

import type { AbilityDef, CardDef } from '@/engine/types';

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'enter', selfOnly: true },
  effect: {
    kind: 'atom',
    verb: 'charSetCard',
    args: { player: 'opp', max: 1, side: 'opp', fromDeckTop: true, faceUp: false },
  },
  description: '【登場時】相手キャラ1枚に 相手デッキ上端を裏向きセット。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/16-card-set.md', 'rules/17-icons.md'],
};

export const B02020P: CardDef = {
  id: 'B02020P',
  no: '0190/B02020P',
  kind: 'character',
  names: ['大岡紅葉'],
  colors: ['緑'],
  level: 6, ap: 5000, lp: 1,
  traits: ['高校生'], keywords: [],
  rarity: 'SRP',
  imageUrl: '1721357188629969.jpg',
  abilities: [a2],
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/16-card-set.md', 'rules/17-icons.md'],
};
