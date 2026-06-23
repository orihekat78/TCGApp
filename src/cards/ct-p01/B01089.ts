// cards/ct-p01/B01089 佐藤美和子 (character) — engine拡張 wave removedFilter (removedCharMatches.removedFilter)
// rules: rules/05-turn-phases.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/19-special-rules.md
// 公式テキスト:
//   【相手ターン中】【ターン1】このキャラか自分の現場にいる【黄】のキャラがリムーブされたとき、カードを1枚引く。
//   【ヒラメキ】（証拠からリムーブされるときに発動する）キャラを1枚まで選び、スリープさせる。
// 句マッピング:
//   - 【相手ターン中】 => condition and[ {kind:'turn', player:'opp'} ]
//   - 【ターン1】 => ability.limit {kind:'turn', n:1}
//   - このキャラか自分の現場の【黄】がリムーブされたとき => trigger {hook:'leave:to-remove'} (selfOnly 無し)
//       + removedCharMatches{side:'self', removedFilter:{color:'黄'}}。自身も【黄】ゆえ self-leave を被覆。
//   - カードを1枚引く => draw{self,1}
//   a2: 【ヒラメキ】キャラを1枚まで選び、スリープさせる => triggered {hook:'evidence:remove-by-action', optional:true},
//       choice → sceneSetState{uid:'$pick', state:'sleep', target:pick(scene,either,n:{0,1})} (B01091 a2 同型、
//       hirameki fire 時 auto-pick されるよう明示 $pick+target を保持、0枚可=rules/15)
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
      { kind: 'removedCharMatches', side: 'self', removedFilter: { color: '黄' } },
    ],
  },
  effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
  description: '【相手ターン中】【ターン1】このキャラか自分の現場にいる【黄】のキャラがリムーブされたとき、カードを1枚引く。',
  ruleRefs: ['rules/05-turn-phases.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/19-special-rules.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-evidence',
  trigger: { hook: 'evidence:remove-by-action', optional: true },
  effect: {
    kind: 'choice',
    chooser: 'self',
    options: [
      {
        kind: 'atom',
        verb: 'sceneSetState',
        args: { uid: '$pick', state: 'sleep', target: { kind: 'pick', query: { area: 'scene', side: 'either' }, n: { min: 0, max: 1 }, chooser: 'self' } },
      },
    ],
  },
  description: '【ヒラメキ】キャラを1枚まで選び、スリープさせる。',
  ruleRefs: ['rules/03-field-areas.md', 'rules/10-action-event.md', 'rules/14-refresh.md'],
};

export const B01089: CardDef = {
  id: 'B01089',
  no: '0077/B01089',
  kind: 'character',
  names: ['佐藤美和子'],
  colors: ['黄'],
  level: 5,
  ap: 5000,
  lp: 1,
  traits: ['警察', '警視庁'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1714013067546631.jpg',
  abilities: [a1, a2],
  ruleRefs: ['rules/05-turn-phases.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/19-special-rules.md'],
};
