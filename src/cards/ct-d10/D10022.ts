// cards/ct-d10/D10022 毛利蘭 (character) — engine additive WB2 (2026-07-11)
// B05009 (CT-P05) の完全同一テキスト twin (別印刷・別 cardId 0515/D10022)。句マッピングは B05009.ts ヘッダ参照。
// rules: 07-action-flow.md, 08-contact.md, 10-action-event.md, 13-keywords.md,
//        15-abilities-effects.md, 17-icons.md, 19-special-rules.md
//
// 公式テキスト:
//   【登場時】自分のキャラの能力によって登場した場合、ターン終了時までこのキャラは〚突撃〛を持つ。
//   【絆工藤新一】相手の現場にいるキャラがこのキャラとのコンタクトによってリムーブされたとき、カードを1枚引く。
//   【ヒラメキ】（証拠からリムーブされるときに発動する）カードを1枚引く。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'enter', selfOnly: true },
  condition: { kind: 'enterSource', viaEffect: true, sourceFilter: { kind: 'character' }, side: 'self' },
  effect: { kind: 'atom', verb: 'charGrantKeyword', args: { uid: '$self', kw: '突撃', scope: 'turn' } },
  description:
    '【登場時】自分のキャラの能力によって登場した場合、ターン終了時までこのキャラは〚突撃〛（登場したターンからすぐにアクションできる）を持つ。',
  ruleRefs: ['rules/13-keywords.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'leave:to-remove' },
  condition: {
    kind: 'and',
    cs: [
      { kind: 'bond', cardName: '工藤新一' },
      { kind: 'removedCharMatches', side: 'opp', cause: 'contact-ap', by: 'self' },
    ],
  },
  effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
  description:
    '【絆工藤新一】相手の現場にいるキャラがこのキャラとのコンタクトによってリムーブされたとき、カードを1枚引く。',
  ruleRefs: ['rules/08-contact.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

const a3: AbilityDef = {
  id: 'a3',
  type: 'triggered',
  scope: 'on-evidence',
  trigger: { hook: 'evidence:remove-by-action', optional: true },
  effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
  description: '【ヒラメキ】（証拠からリムーブされるときに発動する）カードを1枚引く。',
  ruleRefs: ['rules/10-action-event.md', 'rules/14-refresh.md'],
};

export const D10022: CardDef = {
  id: 'D10022',
  no: '0515/D10022',
  kind: 'character',
  names: ['毛利蘭'],
  colors: ['青'],
  level: 5,
  ap: 5000,
  lp: 0,
  traits: ['高校生', '毛利探偵事務所', '空手家'],
  keywords: [],
  rarity: 'D',
  imageUrl: '1761913181938533.jpg',
  abilities: [a1, a2, a3],
  ruleRefs: [
    'rules/08-contact.md',
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/19-special-rules.md',
  ],
};
