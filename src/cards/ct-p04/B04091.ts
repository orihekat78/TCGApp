// cards/ct-p04/B04091 ウォッカ (character) — attribution mini-wave ① byPlayer opp-side 観測型 (2026-07-10)
// rules: 10-action-event.md, 13-keywords.md, 14-refresh.md, 15-abilities-effects.md, 17-icons.md, 26-qa-deck-refresh.md
//
// 公式テキスト:
//   【パートナー黒】【自分ターン中】【ターン1】自分の能力や効果によって相手の現場にいるキャラをリムーブ
//   したとき、カードを2枚引き、手札を1枚リムーブする。
//   【ヒラメキ】（証拠からリムーブされるときに発動する）カードを1枚引く。
// 公式Q&A (character.tsv B04091):
//   Q: 相手の現場のキャラをコンタクトによってリムーブしたとき発動? A: いいえ。コンタクトによるリムーブでは発動しない。
//   Q: 同じカードが複数現場にいる場合すべて同時に発動? A: はい。好きな順で解決。
//   Q: デッキ残り2枚以下の場合? A: 引ききった時点で即座にリフレッシュ、残り1枚あれば1枚引く。そのあとで手札を1枚リムーブ。
//
// 句マッピング:
//   - 【パートナー黒】【自分ターン中】【ターン1】自分の能力や効果によって相手の現場のキャラをリムーブしたとき
//       => a1.trigger{hook:'leave:to-remove'} + limit{turn,1}
//          + condition and[partnerColor{黒}, turn{self}, removedCharMatches{side:'opp',cause:'effect',byPlayer:'self'}]。
//       byPlayer:'self' = 効果 owner=自分 (cond/eval.ts:731、emit=mutate/scene.ts:334)。cause:'effect' 併記=DSL 規約。
//       コンタクト由来 (cause:'contact-ap') は非発火 = Q&A と整合。B04089/B04094 と同 attribution 束。
//   - カードを2枚引き、手札を1枚リムーブする => effect sequence[ draw{n:2}, discard{n:1} ] (D01003 idiom、共に必須)。
//       デッキ不足時のリフレッシュ挙動は engine 既定 (rules/26)、Q&A の順序 (引ききり→リフレッシュ→残り引く→手札リムーブ) と整合。
//   - 【ヒラメキ】カードを1枚引く => a2 trigger{hook:'evidence:remove-by-action', optional:true} + draw{n:1} (D02008/D01003 idiom, rules/10)。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: {
    hook: 'leave:to-remove',
  },
  limit: { kind: 'turn', n: 1 },
  condition: {
    kind: 'and',
    cs: [
      { kind: 'partnerColor', color: '黒' },
      { kind: 'turn', player: 'self' },
      { kind: 'removedCharMatches', side: 'opp', cause: 'effect', byPlayer: 'self' },
    ],
  },
  effect: {
    kind: 'sequence',
    steps: [
      { kind: 'atom', verb: 'draw', args: { player: 'self', n: 2 } },
      { kind: 'atom', verb: 'discard', args: { player: 'self', n: 1 } },
    ],
  },
  description:
    '【パートナー黒】【自分ターン中】【ターン1】自分の能力や効果によって相手の現場のキャラをリムーブしたとき、カードを2枚引き手札を1枚リムーブ。',
  ruleRefs: [
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/26-qa-deck-refresh.md',
  ],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-evidence',
  trigger: { hook: 'evidence:remove-by-action', optional: true },
  effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
  description: '【ヒラメキ】（証拠からリムーブされるときに発動する）カードを1枚引く。',
  ruleRefs: ['rules/10-action-event.md', 'rules/14-refresh.md'],
};

export const B04091: CardDef = {
  id: 'B04091',
  no: '0473/B04091',
  kind: 'character',
  names: ['ウォッカ'],
  colors: ['黒'],
  level: 5,
  ap: 5000,
  lp: 1,
  traits: ['黒ずくめの組織'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1735287841313985.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/10-action-event.md',
    'rules/13-keywords.md',
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/26-qa-deck-refresh.md',
  ],
};
