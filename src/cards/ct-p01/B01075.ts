// cards/ct-p01/B01075 宮野明美 (character) — engine拡張 wave removedFilter (removedCharMatches.removedFilter)
// rules: rules/05-turn-phases.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/19-special-rules.md, rules/22-qa-action-contact.md
// 公式テキスト:
//   【相手ターン中】【ターン1】このキャラか自分の現場にいる【赤】のキャラがリムーブされたとき、カードを1枚引き、手札を1枚リムーブする。
//   【ヒラメキ】（証拠からリムーブされるときに発動する）カードを1枚引く。
// 句マッピング:
//   - 【相手ターン中】 => condition and[ {kind:'turn', player:'opp'} ] [eval.ts case 'turn']
//   - 【ターン1】 => ability.limit {kind:'turn', n:1} (発火枚数に依らず1ターン1回、rules/24) [B01030 a1 同型]
//   - このキャラか自分の現場の【赤】がリムーブされたとき => trigger {hook:'leave:to-remove'} (selfOnly 無し = in-play observer)
//       + condition removedCharMatches{side:'self', removedFilter:{color:'赤'}}
//       自身も【赤】ゆえ self-leave (handleLeaveToRemoveSelf 経路) は color:'赤' に一致 = 「このキャラか」を被覆。
//       [eval.ts removedCharMatches.removedFilter: payload.removedChar snapshot を matchOneFilter で色判定]
//   - カードを1枚引き、手札を1枚リムーブする => sequence[draw{self,1}, discard{self,1}] (D01003 a1 同型、必須)
//   a2: 【ヒラメキ】カードを1枚引く => triggered {hook:'evidence:remove-by-action', optional:true}, scope:'on-evidence', draw{self,1} (B01011 a2 同型)
import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  limit: { kind: 'turn', n: 1 },
  trigger: { hook: 'leave:to-remove' },
  condition: {
    kind: 'and',
    cs: [
      { kind: 'turn', player: 'opp' },
      { kind: 'removedCharMatches', side: 'self', removedFilter: { color: '赤' } },
    ],
  },
  effect: {
    kind: 'sequence',
    steps: [
      { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
      { kind: 'atom', verb: 'discard', args: { player: 'self', n: 1 } },
    ],
  },
  description: '【相手ターン中】【ターン1】このキャラか自分の現場にいる【赤】のキャラがリムーブされたとき、カードを1枚引き、手札を1枚リムーブする。',
  ruleRefs: ['rules/05-turn-phases.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/19-special-rules.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-evidence',
  trigger: { hook: 'evidence:remove-by-action', optional: true },
  effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
  description: '【ヒラメキ】カードを1枚引く。',
  ruleRefs: ['rules/10-action-event.md', 'rules/14-refresh.md'],
};

export const B01075: CardDef = {
  id: 'B01075',
  no: '0065/B01075',
  kind: 'character',
  names: ['宮野明美'],
  colors: ['赤'],
  level: 3,
  ap: 3000,
  lp: 1,
  traits: [],
  keywords: [],
  rarity: 'C',
  imageUrl: '1714013053535170.jpg',
  abilities: [a1, a2],
  ruleRefs: ['rules/05-turn-phases.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/19-special-rules.md', 'rules/22-qa-action-contact.md'],
};
