// CT-P10 B10011 毛利蘭
// rules: 09-cutin-disguise.md, 15-abilities-effects.md, 17-icons.md, 19-special-rules.md
import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1', type: 'continuous', scope: 'on-scene', condition: { kind: 'bond', cardName: '工藤新一' },
  continuousModifier: { opponentEventRestrict: ['remove'] },
  description: '【絆工藤新一】このキャラは相手のイベントの効果によってリムーブされない。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/19-special-rules.md'],
};

const a2: AbilityDef = {
  id: 'a2', type: 'triggered', scope: 'on-hand', trigger: { hook: 'effect:declared', optional: true, selfOnly: true },
  condition: { kind: 'contactCharMatches', who: 'byUid', filter: { cardName: ['工藤新一', '毛利蘭'] } },
  effect: { kind: 'atom', verb: 'charModifyAP', args: { uid: '$contact.byUid', delta: 2000, scope: 'contact' } },
  description: '【カットイン】〚カード名［工藤新一］〛か〚［毛利蘭］〛に【カットイン】する場合、AP＋2000（コンタクト中に手札からリムーブして使う）',
  ruleRefs: ['rules/09-cutin-disguise.md', 'rules/15-abilities-effects.md'],
};

export const B10011: CardDef = {
  id: 'B10011', no: '1073/B10011', kind: 'character', names: ['毛利蘭'], colors: ['青'], level: 2, ap: 1000, lp: 1,
  traits: ['高校生', '毛利探偵事務所', '空手家'], rarity: 'C', imageUrl: '1783904055339447.jpg', abilities: [a1, a2],
  ruleRefs: ['rules/09-cutin-disguise.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/19-special-rules.md'],
};
