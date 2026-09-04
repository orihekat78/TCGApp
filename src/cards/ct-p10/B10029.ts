// CT-P10 B10029 国末照明
// rules: 03-field-areas.md, 14-refresh.md, 15-abilities-effects.md, 17-icons.md
import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1', type: 'triggered', scope: 'on-scene',
  trigger: { hook: 'enter', selfOnly: true },
  effect: {
    kind: 'conditional',
    if: {
      kind: 'and',
      cs: [
        { kind: 'charStateIs', ref: { kind: 'self' }, state: 'active' },
        { kind: 'sceneHas', query: { area: 'scene', side: 'self', filter: { cardName: ['服部平次', '遠山和葉'] } }, nMin: 1 },
      ],
    },
    then: { kind: 'optional', effect: { kind: 'chain', steps: [
      { kind: 'atom', verb: 'sceneSetState', args: { uid: '$self', state: 'sleep' } },
      { kind: 'atom', verb: 'handAddFromRemove', args: { player: 'self', max: 1, filter: { color: '緑', kind: 'event' } } },
    ] } },
  },
  description: '【登場時】服部平次か遠山和葉がいれば、このキャラをスリープさせてもよい。そうした場合、リムーブの【緑】イベントを1枚まで手札に加える。',
  ruleRefs: ['rules/03-field-areas.md', 'rules/14-refresh.md', 'rules/15-abilities-effects.md'],
};

export const B10029: CardDef = {
  id: 'B10029', no: '1090/B10029', kind: 'character', names: ['国末照明'], colors: ['緑'], level: 3, ap: 2000, lp: 1,
  traits: ['大学生'], keywords: [], rarity: 'C', imageUrl: '1783904116874908.jpg', abilities: [a1],
  ruleRefs: ['rules/03-field-areas.md', 'rules/14-refresh.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md'],
};
