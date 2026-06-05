// cards/ct-p02/B02046P 黒羽盗一 (パラレル) — B02046 と同型

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'enter', selfOnly: true },
  effect: {
    kind: 'choice',
    chooser: 'self',
    options: [
      {
        kind: 'sequence',
        steps: [
          {
            kind: 'atom',
            verb: 'charSetCard',
            args: {
              uid: '$pick',
              fromDeckTop: true,
              faceUp: false,
              player: 'self',
              target: {
                kind: 'pick',
                query: { area: 'scene', side: 'self', filter: { color: '白' } },
                n: { min: 0, max: 1 },
                chooser: 'self',
              },
            },
          },
          {
            kind: 'atom',
            verb: 'charModifyAP',
            args: { uid: '$pick', delta: 1000, scope: 'turn' },
          },
        ],
      },
    ],
  },
  description: '【登場時】自陣【白】1枚に 自デッキ上端 setCard + ターン終了時まで AP+1000。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/16-card-set.md', 'rules/17-icons.md'],
};

export const B02046P: CardDef = {
  id: 'B02046P',
  no: '0212/B02046P',
  kind: 'character',
  names: ['黒羽盗一'],
  colors: ['白'],
  level: 5, ap: 5000, lp: 1,
  traits: ['マジシャン'], keywords: [],
  rarity: 'CP',
  imageUrl: '1721357230992096.jpg',
  abilities: [a1],
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/16-card-set.md', 'rules/17-icons.md'],
};
