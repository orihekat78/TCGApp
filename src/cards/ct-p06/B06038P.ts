// cards/ct-p06/B06038P 鬼丸猛 (character, パラレル) — engine拡張 wave#2 cluster15 follow-up (2026-06-18)
// rules: 07-action-flow.md, 08-contact.md, 10-action-event.md, 13-keywords.md,
//        15-abilities-effects.md, 17-icons.md, 22-qa-action-contact.md, 24-qa-naming-stun.md
//
// B06038 のパラレル (テキスト・能力とも完全同一、rarity/imageUrl のみ差)。句マッピングは B06038.ts 参照。

import type { AbilityDef, CardDef } from '@/engine/types';
import { partnerColorKeyword } from '../_shared/index.js';

const a1: AbilityDef = partnerColorKeyword({ color: '緑', kw: '突撃', abilityId: 'a1' });

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'leave:to-remove' },
  condition: { kind: 'removedCharMatches', side: 'opp', cause: 'contact-ap', by: 'self' },
  effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
  description:
    '相手の現場にいるキャラがこのキャラとのコンタクトによってリムーブされたとき、カードを1枚引く。',
  ruleRefs: [
    'rules/07-action-flow.md',
    'rules/08-contact.md',
    'rules/15-abilities-effects.md',
    'rules/22-qa-action-contact.md',
  ],
};

const a3: AbilityDef = {
  id: 'a3',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'evidence:gain', selfOnly: true },
  effect: { kind: 'atom', verb: 'discard', args: { player: 'opp', n: 1 } },
  description:
    'このキャラのアクション［事件］によって証拠を得たとき、相手は手札を1枚リムーブする。',
  ruleRefs: ['rules/10-action-event.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

export const B06038P: CardDef = {
  id: 'B06038P',
  no: '0661/B06038P',
  kind: 'character',
  names: ['鬼丸猛'],
  colors: ['緑'],
  level: 8,
  ap: 8000,
  lp: 0,
  traits: ['高校生'],
  keywords: [],
  rarity: 'SRP',
  imageUrl: '1755684948533818.jpg',
  abilities: [a1, a2, a3],
  ruleRefs: [
    'rules/07-action-flow.md',
    'rules/08-contact.md',
    'rules/10-action-event.md',
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/22-qa-action-contact.md',
    'rules/24-qa-naming-stun.md',
  ],
};
