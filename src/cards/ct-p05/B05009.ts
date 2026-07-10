// cards/ct-p05/B05009 毛利蘭 (character) — engine additive WB2 (2026-07-11)
// rules: 07-action-flow.md, 08-contact.md, 09-cutin-disguise.md, 10-action-event.md,
//        13-keywords.md, 15-abilities-effects.md, 17-icons.md, 19-special-rules.md
//
// 公式テキスト:
//   【登場時】自分のキャラの能力によって登場した場合、ターン終了時までこのキャラは〚突撃〛
//     （登場したターンからすぐにアクションできる）を持つ。
//   【絆工藤新一】相手の現場にいるキャラがこのキャラとのコンタクトによってリムーブされたとき、カードを1枚引く。
//   【ヒラメキ】（証拠からリムーブされるときに発動する）カードを1枚引く。
//
// 句マッピング:
//   - a1「【登場時】自分のキャラの能力によって登場した場合、〚突撃〛を持つ」=> triggered enter selfOnly +
//     condition enterSource{viaEffect:true, sourceFilter:{kind:'character'}, side:'self'} → charGrantKeyword{$self,突撃,turn}。
//     WB2 engine: enterSource に side 追加 + enter emit に sourcePlayer 同梱。「自分の」= 原因カード所有側 == 登場側。
//     sourceFilter:{kind:'character'} = イベント除外 (公式Q&A「自分のイベントの効果で登場は条件不成立」)。
//   - a2「【絆工藤新一】相手の現場にいるキャラがこのキャラとのコンタクトによってリムーブされたとき、カードを1枚引く」=>
//     triggered leave:to-remove + condition and[bond{cardName:工藤新一}, removedCharMatches{side:opp, cause:contact-ap, by:self}]
//     → draw 1 (B01010 反撃一族 同型 + 絆 gate)。by:'self' = byUid===ctx.source.uid (このキャラが contact winner)。
//   - a3「【ヒラメキ】カードを1枚引く」=> triggered evidence:remove-by-action optional → draw 1 (D01013 a2 同型)。

import type { AbilityDef, CardDef } from '@/engine/types';

// 【登場時】自分のキャラの能力によって登場 → 突撃 (ターン終了まで)
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

// 【絆工藤新一】相手のキャラがこのキャラとのコンタクトでリムーブ → draw 1
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

// 【ヒラメキ】カードを1枚引く
const a3: AbilityDef = {
  id: 'a3',
  type: 'triggered',
  scope: 'on-evidence',
  trigger: { hook: 'evidence:remove-by-action', optional: true },
  effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
  description: '【ヒラメキ】（証拠からリムーブされるときに発動する）カードを1枚引く。',
  ruleRefs: ['rules/10-action-event.md', 'rules/14-refresh.md'],
};

export const B05009: CardDef = {
  id: 'B05009',
  no: '0515/B05009',
  kind: 'character',
  names: ['毛利蘭'],
  colors: ['青'],
  level: 5,
  ap: 5000,
  lp: 0,
  traits: ['高校生', '毛利探偵事務所', '空手家'],
  keywords: [],
  rarity: 'R',
  imageUrl: '1746628061705882.jpg',
  abilities: [a1, a2, a3],
  ruleRefs: [
    'rules/08-contact.md',
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/19-special-rules.md',
  ],
};
