// cards/ct-p05/B05059 白馬探 (character) — engine拡張 wave removedFilter (removedCharMatches.removedFilter)
// rules: rules/03-field-areas.md, rules/05-turn-phases.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/21-declared-ability-cost.md
// 公式テキスト:
//   【相手ターン中】【ターン1】スリープ状態のこのキャラか自分の現場にいるスリープ状態の〚特徴［探偵］〛のキャラがリムーブされたとき、カードを1枚引く。
//   【宣言】【ターン1】〚このキャラ以外の特徴［探偵］のキャラを1枚スリープさせる〛：AP8000以下のキャラを1枚まで選び、リムーブする。
// 句マッピング:
//   a1:
//   - 【相手ターン中】 => condition and[ {kind:'turn', player:'opp'} ]
//   - 【ターン1】 => limit {kind:'turn', n:1}
//   - スリープ状態のこのキャラか自分の現場のスリープ状態の〚探偵〛がリムーブ => trigger {hook:'leave:to-remove'} (selfOnly 無し)
//       + removedCharMatches{side:'self', removedFilter:{trait:'探偵', state:['sleep']}}。
//       自身も〚探偵〛ゆえ sleep 状態で除去された場合 self-leave 経路が {trait:探偵,state:sleep} に一致 = 「スリープ状態のこのキャラ」を被覆。
//       ⚠ state は matchOneFilter 非対応のため eval.ts removedCharMatches が snapshot.state を明示判定 (除去直前状態)。
//   - カードを1枚引く => draw{self,1}
//   a2 (【宣言】):
//   - 【ターン1】 => limit {kind:'turn', n:1}
//   - 〚このキャラ以外の特徴［探偵］のキャラを1枚スリープさせる〛(cost) => sleepChar{pick(scene,self,excludeSelf,filter:{trait:'探偵'}),n:{1,1}} (B03060 a 同型、rules/21「自分の」省略)
//   - AP8000以下のキャラを1枚まで選び、リムーブする => sceneRemove{player:'self', max:1, side:'either', filter:{apMax:8000}} (D02002 同型、0枚可=rules/15)
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
      { kind: 'removedCharMatches', side: 'self', removedFilter: { trait: '探偵' }, removedState: ['sleep'] },
    ],
  },
  effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
  description: '【相手ターン中】【ターン1】スリープ状態のこのキャラか自分の現場にいるスリープ状態の〚特徴［探偵］〛のキャラがリムーブされたとき、カードを1枚引く。',
  ruleRefs: ['rules/03-field-areas.md', 'rules/05-turn-phases.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'declared',
  scope: 'on-scene',
  limit: { kind: 'turn', n: 1 },
  cost: {
    kind: 'sleepChar',
    target: { kind: 'pick', query: { area: 'scene', side: 'self', excludeSelf: true, filter: { trait: '探偵' } }, n: { min: 1, max: 1 }, chooser: 'self' },
  },
  effect: {
    kind: 'atom',
    verb: 'sceneRemove',
    args: { player: 'self', max: 1, side: 'either', filter: { apMax: 8000 } },
  },
  description: '【宣言】【ターン1】〚このキャラ以外の特徴［探偵］のキャラを1枚スリープさせる〛：AP8000以下のキャラを1枚まで選び、リムーブする。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/21-declared-ability-cost.md'],
};

export const B05059: CardDef = {
  id: 'B05059',
  no: '0561/B05059',
  kind: 'character',
  names: ['白馬探'],
  colors: ['白'],
  level: 8,
  ap: 7000,
  lp: 2,
  traits: ['探偵', '高校生'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1745322205553436.jpg',
  abilities: [a1, a2],
  ruleRefs: ['rules/03-field-areas.md', 'rules/05-turn-phases.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/21-declared-ability-cost.md'],
};
