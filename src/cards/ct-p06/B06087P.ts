// cards/ct-p06/B06087P 萩原千速 (character, パラレル) — engine拡張 wave#2 cluster16 (self-remove removal-observer, 2026-06-18)
// rules: 07-action-flow.md, 08-contact.md, 13-keywords.md, 15-abilities-effects.md,
//        17-icons.md, 19-special-rules.md, 20-color-and-switch.md, 22-qa-action-contact.md
//
// B06087 のパラレル (テキスト・能力とも完全同一、rarity/imageUrl のみ差)。句マッピングは PR280.ts / B06087.ts 参照。
//   ⚠ 自己リムーブ removal-observer の再入安全性: tests/cards/hagiwara-self-remove-observer.test.ts で実証。

import type { AbilityDef, CardDef } from '@/engine/types';
import { partnerColorKeyword } from '../_shared/index.js';

// a1: 【パートナー黄】〚突撃〛
const a1: AbilityDef = partnerColorKeyword({ color: '黄', kw: '突撃', abilityId: 'a1' });

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-scene',
  // 【FILE6】 AND 「このキャラとのコンタクトによって」
  condition: {
    kind: 'and',
    cs: [
      { kind: 'fileAtLeast', n: 6 },
      { kind: 'removedCharMatches', side: 'opp', cause: 'contact-ap', by: 'self' },
    ],
  },
  trigger: { hook: 'leave:to-remove' },
  effect: {
    kind: 'optional',
    effect: {
      kind: 'sequence',
      steps: [
        { kind: 'atom', verb: 'sceneRemove', args: { uid: '$self', cause: 'effect' } },
        {
          kind: 'atom',
          verb: 'sceneEnter',
          args: {
            player: 'self',
            from: 'hand',
            max: 1,
            viaEffect: true,
            filter: { cardNameNot: '萩原千速', trait: '警察', levelMax: 7, kind: 'character' },
          },
        },
      ],
    },
  },
  description:
    '【FILE6】相手の現場にいるキャラがこのキャラとのコンタクトによってリムーブされたとき、このキャラを現場からリムーブしてもよい。そうした場合、手札から〚カード名［萩原千速］〛以外のレベル7以下の〚特徴［警察］〛のキャラを1枚まで登場させる。',
  ruleRefs: [
    'rules/07-action-flow.md',
    'rules/08-contact.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/19-special-rules.md',
    'rules/20-color-and-switch.md',
  ],
};

export const B06087P: CardDef = {
  id: 'B06087P',
  no: '0706/B06087P',
  kind: 'character',
  names: ['萩原千速'],
  colors: ['黄'],
  level: 7,
  ap: 5000,
  lp: 1,
  traits: ['警察', '神奈川県警'],
  keywords: [],
  rarity: 'RP',
  imageUrl: '1755684967134347.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/07-action-flow.md',
    'rules/08-contact.md',
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/19-special-rules.md',
    'rules/20-color-and-switch.md',
    'rules/22-qa-action-contact.md',
  ],
};
