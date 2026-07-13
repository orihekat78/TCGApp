// cards/ct-p02/B02022 鬼丸猛 (キャラ)
// rules: 07-action-flow.md, 10-action-event.md, 15-abilities-effects.md, 17-icons.md

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'action:pre-target' },
  effect: { kind: 'atom', verb: 'mustTargetSelfOnce', args: {} },
  description: '【ターン1】相手の現場にいるキャラがアクションするとき、このキャラを指定できる場合、必ず指定する。',
  ruleRefs: ['rules/07-action-flow.md', 'rules/15-abilities-effects.md'],
};

const a2: AbilityDef = {
  id: 'a2', type: 'triggered', scope: 'on-evidence',
  trigger: { hook: 'evidence:remove-by-action', optional: true },
  effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
  description: '【ヒラメキ】カードを1枚引く。',
  ruleRefs: ['rules/10-action-event.md', 'rules/15-abilities-effects.md'],
};

export const B02022: CardDef = {
  id: 'B02022', no: '0192/B02022', kind: 'character', names: ['鬼丸猛'],
  colors: ['緑'], level: 7, ap: 6000, lp: 0, traits: ['高校生'], keywords: ['突撃[キャラ]'],
  rarity: 'R', imageUrl: '1721357188635287.jpg', abilities: [a1, a2],
  ruleRefs: ['rules/07-action-flow.md', 'rules/10-action-event.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md'],
};
