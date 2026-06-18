// cards/ct-p09/B09071P2 萩原千速 (character, パラレル2) — engine拡張 wave#2 cluster15 follow-up (2026-06-18)
// rules: 03-field-areas.md, 07-action-flow.md, 08-contact.md, 13-keywords.md,
//        15-abilities-effects.md, 17-icons.md, 22-qa-action-contact.md, 24-qa-naming-stun.md
//
// B09071 のパラレル2 (テキスト・能力とも完全同一、rarity/imageUrl のみ差)。句マッピングは B09071.ts 参照。

import type { AbilityDef, CardDef } from '@/engine/types';
import { partnerColorKeyword } from '../_shared/index.js';

const a1: AbilityDef = partnerColorKeyword({ color: '黄', kw: '突撃', abilityId: 'a1' });

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'enter', selfOnly: true, matcherCondition: { kind: 'enterOrderEquals', n: 1 } },
  effect: { kind: 'atom', verb: 'charSetTurnEffect', args: { uid: '$self', key: 'actionTargetsActive', val: true } },
  description:
    '【疾風】ターン終了時までこのキャラは「このキャラは相手の現場にいるアクティブ状態のキャラを指定してアクションできる。」を持つ。（自分の現場にこのターンで1番に登場したときに発動する）',
  ruleRefs: ['rules/07-action-flow.md', 'rules/13-keywords.md', 'rules/17-icons.md'],
};

const a3: AbilityDef = {
  id: 'a3',
  type: 'triggered',
  scope: 'on-scene',
  limit: { kind: 'turn', n: 1 },
  trigger: { hook: 'leave:to-remove' },
  condition: { kind: 'removedCharMatches', side: 'opp', cause: 'contact-ap', by: 'self' },
  effect: { kind: 'atom', verb: 'sceneSetState', args: { player: 'self', max: 1, side: 'either', state: 'sleep' } },
  description:
    '【ターン1】相手の現場にいるキャラがこのキャラとのコンタクトによってリムーブされたとき、キャラを1枚まで選び、スリープさせる。',
  ruleRefs: ['rules/07-action-flow.md', 'rules/08-contact.md', 'rules/17-icons.md'],
};

export const B09071P2: CardDef = {
  id: 'B09071P2',
  no: '1011/B09071P2',
  kind: 'character',
  names: ['萩原千速'],
  colors: ['黄'],
  level: 8,
  ap: 8000,
  lp: 1,
  traits: ['警察', '神奈川県警'],
  keywords: [],
  rarity: 'SRCP',
  imageUrl: '1775693378144584.jpg',
  abilities: [a1, a2, a3],
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/07-action-flow.md',
    'rules/08-contact.md',
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/22-qa-action-contact.md',
    'rules/24-qa-naming-stun.md',
  ],
};
