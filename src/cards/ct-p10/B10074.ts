// CT-P10 B10074 風見裕也
// rules: 03-field-areas.md, 10-action-event.md, 15-abilities-effects.md, 17-icons.md, 19-special-rules.md
// Official Q&A: 「元の能力」はカードに印字された能力。無効化中でも持つ扱いで、
// 外部から与えられた能力は元の能力ではない。
import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'enter', selfOnly: true },
  effect: {
    kind: 'atom',
    verb: 'sceneEnter',
    args: {
      player: 'self',
      from: 'remove',
      max: 1,
      viaEffect: true,
      filter: {
        kind: 'character',
        hasNoOriginalAbilityExceptIcons: ['カットイン', 'ヒラメキ'],
      },
    },
  },
  description: '【登場時】自分のリムーブエリアにある【カットイン】と【ヒラメキ】以外の元の能力を持たないキャラを1枚まで選び、登場させる。',
  ruleRefs: ['rules/03-field-areas.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/19-special-rules.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-evidence',
  trigger: { hook: 'evidence:remove-by-action', optional: true },
  effect: {
    kind: 'atom',
    verb: 'sceneSetState',
    args: { player: 'self', max: 1, side: 'either', filter: { kind: 'character' }, state: 'sleep' },
  },
  description: '【ヒラメキ】（証拠からリムーブされるときに発動する）キャラを1枚まで選び、スリープさせる。',
  ruleRefs: ['rules/10-action-event.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

export const B10074: CardDef = {
  id: 'B10074',
  no: '1130/B10074',
  kind: 'character',
  names: ['風見裕也'],
  colors: ['黄'],
  level: 7,
  ap: 5000,
  lp: 1,
  traits: ['警察', '警視庁', '公安'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1783904202640341.jpg',
  abilities: [a1, a2],
  ruleRefs: ['rules/03-field-areas.md', 'rules/10-action-event.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/19-special-rules.md'],
};
