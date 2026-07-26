// CT-P10 B10073 鬼塚八蔵 (character)
// rules: 03-field-areas, 10-action-event, 14-refresh, 15-abilities-effects, 17-icons, 19-special-rules, 20-color-and-switch

import type { AbilityDef, CardDef } from '@/engine/types';

const policeNames = ['降谷零', '諸伏景光', '伊達航', '萩原研二', '松田陣平'];

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'enter', selfOnly: true },
  condition: {
    kind: 'and',
    cs: [
      { kind: 'caseStatus', status: '解決編' },
      { kind: 'enterSource', viaEffect: true, side: 'self', sourceFilter: { kind: 'character' } },
    ],
  },
  effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
  description: '【解決編】【登場時】自分のキャラの能力によって登場した場合、カードを1枚引く。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-evidence',
  trigger: { hook: 'evidence:remove-by-action', optional: true },
  effect: {
    kind: 'atom',
    verb: 'handAddFromRemove',
    args: { player: 'self', max: 1, filter: { kind: 'character', cardName: policeNames } },
  },
  description: '【ヒラメキ】自分のリムーブエリアにある〚カード名［降谷零］〛か〚［諸伏景光］〛か〚［伊達航］〛か〚［萩原研二］〛か〚［松田陣平］〛を1枚まで選び、手札に加える。',
  ruleRefs: ['rules/10-action-event.md', 'rules/15-abilities-effects.md', 'rules/19-special-rules.md'],
};

export const B10073: CardDef = {
  id: 'B10073', no: '1129/B10073', kind: 'character', names: ['鬼塚八蔵'],
  colors: ['黄'], level: 3, ap: 2000, lp: 1, traits: ['警察', '警視庁'], keywords: [], rarity: 'C',
  imageUrl: '1783904202633441.jpg', abilities: [a1, a2],
  ruleRefs: ['rules/03-field-areas.md', 'rules/10-action-event.md', 'rules/14-refresh.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/19-special-rules.md', 'rules/20-color-and-switch.md'],
};
