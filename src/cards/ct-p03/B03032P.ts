// cards/ct-p03/B03032P 服部平次 (パラレル) — B03032 と同型

import type { AbilityDef, CardDef } from '@/engine/types';
import { partnerColorKeyword } from '../_shared/index.js';

const a1 = partnerColorKeyword({ color: '緑', kw: '突撃', abilityId: 'a1' });

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'action:pre-target', selfOnly: true },
  effect: {
    kind: 'atom',
    verb: 'expandActionTargets',
    args: { side: 'opp', state: ['active'], hasSetCards: true },
  },
  description: 'このキャラは相手の現場にいるカードがセットされているアクティブ状態のキャラを指定してアクションできる。',
  ruleRefs: ['rules/07-action-flow.md', 'rules/16-card-set.md'],
};

const a3: AbilityDef = {
  id: 'a3',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'enter', selfOnly: true },
  effect: {
    kind: 'atom',
    verb: 'charSetCard',
    args: { player: 'opp', max: 1, side: 'opp', fromDeckTop: true, faceUp: false },
  },
  description: '【登場時】相手キャラ1枚に 相手デッキ上端を裏向きセット。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/16-card-set.md', 'rules/17-icons.md'],
};

export const B03032P: CardDef = {
  id: 'B03032P',
  no: '0289/B03032P',
  kind: 'character',
  names: ['服部平次'],
  colors: ['緑'],
  level: 7, ap: 5000, lp: 1,
  traits: ['探偵', '高校生'], keywords: [],
  rarity: 'CP',
  imageUrl: '1729133249293615.jpg',
  abilities: [a1, a2, a3],
  ruleRefs: ['rules/13-keywords.md', 'rules/15-abilities-effects.md', 'rules/16-card-set.md', 'rules/17-icons.md'],
};
