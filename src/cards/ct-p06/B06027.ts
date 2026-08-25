// rules: 09-cutin-disguise.md, 10-action-event.md, 15-abilities-effects.md, 17-icons.md, 20-color-and-switch.md, 22-qa-action-contact.md
import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1', type: 'triggered', scope: 'on-hand',
  trigger: { hook: 'effect:declared', optional: true, selfOnly: true },
  effect: { kind: 'atom', verb: 'charModifyAP', args: { uid: '$contact.byUid', delta: 1000, scope: 'contact' } },
  description: '【カットイン】AP＋1000。',
  ruleRefs: ['rules/09-cutin-disguise.md', 'rules/22-qa-action-contact.md'],
};

const a2: AbilityDef = {
  id: 'a2', type: 'triggered', scope: 'on-evidence',
  trigger: { hook: 'evidence:remove-by-action', optional: true },
  condition: { kind: 'caseStatus', status: '解決編' },
  effect: {
    kind: 'atom', verb: 'sceneEnter',
    args: {
      player: 'self', cardId: '$occurrence.cardId', selectedCardIndex: '$occurrence.index',
      exactSelectedCardIndex: true, sourceRequired: true, enterSleep: true,
      deferSceneSwitchChoice: true,
      target: { kind: 'pick', query: { area: 'remove', side: 'self', filter: { cardId: '$occurrence.cardId', kind: 'character' } }, n: { min: 1, max: 1 }, chooser: 'self' },
    },
  },
  description: '【ヒラメキ】【解決編】このキャラをスリープ状態で登場させる。',
  ruleRefs: ['rules/03-field-areas.md', 'rules/10-action-event.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/20-color-and-switch.md'],
};

export const B06027: CardDef = {
  id: 'B06027', no: '0650/B06027', kind: 'character', names: ['カマキリ男＆ナマコ男＆ヒトデ男', 'カマキリ男', 'ナマコ男', 'ヒトデ男'],
  colors: ['緑'], level: 2, ap: 1000, lp: 0, traits: ['YAIBA'], rarity: 'C', imageUrl: '1754285189416293.jpg',
  abilities: [a1, a2],
  ruleRefs: ['rules/03-field-areas.md', 'rules/09-cutin-disguise.md', 'rules/10-action-event.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/20-color-and-switch.md', 'rules/22-qa-action-contact.md'],
};
