// cards/ct-p06/B06039P 沖田総司 (character, パラレル) — engine拡張 wave#2 cluster15 follow-up (2026-06-18)
// rules: 03-field-areas.md, 07-action-flow.md, 08-contact.md, 10-action-event.md, 13-keywords.md,
//        15-abilities-effects.md, 17-icons.md, 22-qa-action-contact.md, 24-qa-naming-stun.md
//
// B06039 のパラレル (テキスト・能力とも完全同一、rarity/imageUrl のみ差)。句マッピングは B06039.ts 参照。

import type { AbilityDef, CardDef } from '@/engine/types';
import { partnerColorKeyword } from '../_shared/index.js';

const a1: AbilityDef = partnerColorKeyword({ color: '緑', kw: '突撃[キャラ]', abilityId: 'a1' });

const a2: AbilityDef = {
  id: 'a2',
  type: 'continuous',
  scope: 'on-scene',
  condition: { kind: 'turn', player: 'self' },
  continuousModifier: { apDelta: 1000 },
  description: '【自分ターン中】AP＋1000',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/24-qa-naming-stun.md'],
};

const a3: AbilityDef = {
  id: 'a3',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'leave:to-remove' },
  condition: { kind: 'removedCharMatches', side: 'opp', cause: 'contact-ap', by: 'self' },
  effect: {
    kind: 'sequence',
    steps: [
      { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
      { kind: 'atom', verb: 'discard', args: { player: 'self', n: 1 } },
    ],
  },
  description:
    '相手の現場にいるキャラがこのキャラとのコンタクトによってリムーブされたとき、カードを1枚引き、手札を1枚リムーブする。',
  ruleRefs: [
    'rules/08-contact.md',
    'rules/15-abilities-effects.md',
    'rules/22-qa-action-contact.md',
  ],
};

const a4: AbilityDef = {
  id: 'a4',
  type: 'triggered',
  scope: 'on-evidence',
  trigger: { hook: 'evidence:remove-by-action', optional: true },
  effect: {
    kind: 'atom',
    verb: 'sceneSetState',
    args: {
      uid: '$pick',
      state: 'sleep',
      target: { kind: 'pick', query: { area: 'scene', side: 'either' }, n: { min: 0, max: 1 }, chooser: 'self' },
    },
  },
  description: '【ヒラメキ】（証拠からリムーブされるときに発動する）キャラを1枚まで選び、スリープさせる。',
  ruleRefs: ['rules/10-action-event.md', 'rules/03-field-areas.md'],
};

export const B06039P: CardDef = {
  id: 'B06039P',
  no: '0662/B06039P',
  kind: 'character',
  names: ['沖田総司'],
  colors: ['緑'],
  level: 7,
  ap: 6000,
  lp: 0,
  traits: ['高校生'],
  keywords: [],
  rarity: 'RP',
  imageUrl: '1755684948539463.jpg',
  abilities: [a1, a2, a3, a4],
  ruleRefs: [
    'rules/03-field-areas.md',
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
