// cards/ct-d09/D09015 大和敢助 (キャラ - 別パッケージ) — bounce batch #2
// D09014 と同型 (imageUrl のみ差分、別パッケージ収録)

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'enter', selfOnly: true },
  condition: { kind: 'fileAtLeast', n: 7 },
  effect: {
    kind: 'atom',
    verb: 'sceneSetState',
    args: { player: 'self', max: 1, side: 'either', state: 'sleep' },
  },
  description: '【FILE7】【登場時】キャラを1枚までスリープ。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'declared',
  scope: 'on-scene',
  condition: { kind: 'partnerColor', color: '黄' },
  cost: { kind: 'sleepSelf' },
  effect: {
    kind: 'atom',
    verb: 'sceneToHand',
    args: {
      uid: '$pick',
      target: {
        kind: 'pick',
        query: { area: 'scene', side: 'opp', filter: { levelMax: 5 }, state: ['sleep'] },
        n: { min: 0, max: 1 },
        chooser: 'self',
      },
    },
  },
  description: '【パートナー黄】【宣言】【スリープ】：相手 level≤5 スリープを1枚 bounce。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/21-declared-ability-cost.md'],
};

export const D09015: CardDef = {
  id: 'D09015',
  no: '0505/D09015',
  kind: 'character',
  names: ['大和敢助'],
  colors: ['黄'],
  level: 5, ap: 5000, lp: 1,
  traits: ['警察', '長野県警'], keywords: [],
  rarity: 'D',
  imageUrl: '1743742875205852.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md',
  ],
};
