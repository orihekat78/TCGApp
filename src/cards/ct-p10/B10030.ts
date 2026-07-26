// CT-P10 B10030 坂田祐介
// rules: 09-cutin-disguise.md, 15-abilities-effects.md, 16-card-set.md, 17-icons.md
import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1', type: 'triggered', scope: 'on-scene',
  trigger: { hook: 'enter', selfOnly: true },
  condition: { kind: 'caseStatus', status: '解決編' },
  effect: { kind: 'atom', verb: 'charSetCard', args: { uid: '$self', player: 'self', fromDeckTop: true, faceUp: false } },
  description: '【解決編】【登場時】デッキのカードを上から1枚裏向きでこのキャラにセットする。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/16-card-set.md'],
};

const a2: AbilityDef = {
  id: 'a2', type: 'triggered', scope: 'on-hand',
  trigger: { hook: 'effect:declared', optional: true, selfOnly: true },
  condition: { kind: 'contactCharMatches', who: 'byUid', filter: { color: '緑', trait: '警察' } },
  effect: { kind: 'atom', verb: 'charModifyAP', args: { uid: '$contact.byUid', delta: 2000, scope: 'contact' } },
  description: '【カットイン】【緑】の【特徴［警察］】のキャラにカットインする場合、AP＋2000。',
  ruleRefs: ['rules/09-cutin-disguise.md', 'rules/15-abilities-effects.md', 'rules/22-qa-action-contact.md'],
};

export const B10030: CardDef = {
  id: 'B10030', no: '1091/B10030', kind: 'character', names: ['坂田祐介'], colors: ['緑'], level: 2, ap: 1000, lp: 1,
  traits: ['警察', '大阪府警'], keywords: [], rarity: 'C', imageUrl: '1783904116882027.jpg', abilities: [a1, a2],
  ruleRefs: ['rules/09-cutin-disguise.md', 'rules/15-abilities-effects.md', 'rules/16-card-set.md', 'rules/17-icons.md', 'rules/22-qa-action-contact.md'],
};
