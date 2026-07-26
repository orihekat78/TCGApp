// rules: 09-cutin-disguise.md, 15-abilities-effects.md, 17-icons.md, 22-qa-action-contact.md
import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1', type: 'triggered', scope: 'on-hand',
  trigger: { hook: 'effect:declared', optional: true, selfOnly: true },
  condition: { kind: 'partnerColor', color: '赤' },
  effect: {
    kind: 'conditional', if: { kind: 'handAtMost', player: 'self', n: 2 },
    then: { kind: 'atom', verb: 'charModifyAP', args: { uid: '$contact.byUid', delta: 3000, scope: 'contact' } },
    else: { kind: 'atom', verb: 'charModifyAP', args: { uid: '$contact.byUid', delta: 1000, scope: 'contact' } },
  },
  description: '【カットイン】【パートナー赤】AP＋1000、自分の手札が2枚以下の場合、代わりにAP＋3000。',
  ruleRefs: ['rules/09-cutin-disguise.md', 'rules/17-icons.md', 'rules/22-qa-action-contact.md'],
};

export const B10058: CardDef = {
  id: 'B10058', no: '1117/B10058', kind: 'character', names: ['世良真純'], colors: ['赤'], level: 2, ap: 1000, lp: 1,
  traits: ['探偵', '高校生', '赤井家'], keywords: [], rarity: 'C', imageUrl: '1783904159456372.jpg', abilities: [a1],
  ruleRefs: ['rules/09-cutin-disguise.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/22-qa-action-contact.md'],
};
