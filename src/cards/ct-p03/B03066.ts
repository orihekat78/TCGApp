// cards/ct-p03/B03066 赤井秀一 (character) — ENGINE0 wave (engine変更0)
// rules: rules/13-keywords.md, rules/15-abilities-effects.md, rules/17-icons.md
// 公式テキスト:
//   【パートナー赤】〚突撃［事件］〛（登場したターンからすぐに事件を指定してアクションできる）
//   【登場時】相手に証拠を1つ与えてもよい。そうした場合、レベル7以下のキャラを1枚まで選び、リムーブする。
// 句マッピング:
//   - 【パートナー赤】〚突撃［事件］〛 => a1 = partnerColorKeyword({ color:'赤', kw:'突撃[事件]', abilityId:'a1' })
//       [共通クラス src/cards/_shared/partnerColorKeyword.ts (type 'continuous' + condition partnerColor + grantKeywords)。
//        EXACT 同型 src/cards/ct-p08/B08007.ts a1 = partnerColorKeyword({color:'青', kw:'突撃[事件]', abilityId:'a1'})。
//        【パートナー赤】不成立時は「持っていない扱い」(rules/17 Point) = condition false で grantKeywords 無効。]
//   - 【登場時】相手に証拠を1つ与えてもよい。そうした場合、レベル7以下のキャラを1枚まで選び、リムーブする
//       => a2 = enter trigger + optional[sequence[evidenceGain opp, sceneRemove lv7以下 1まで either]]
//       [EXACT structural twin src/cards/ct-p01/B01069.ts a1 (enter + optional[sequence[evidenceGain opp, X]]、
//        B03066 は X=draw の代わりに sceneRemove)。「してもよい」= optional (rules/15、辞退可)。evidenceGain opp は
//        必ず成功 (相手は辞退不可、公式Q&A) ゆえ sequence で sceneRemove が続く =「そうした場合」と一致。
//        sceneRemove EXACT 同型 src/cards/ct-p07/B07080.ts a1 {player:'self', max:1, side:'either', cause:'effect',
//        filter:{levelMax:7}} (「キャラ」エリア指定なし=either rules/15、「1枚まで」=max:1 0-pick可、levelMax honored
//        candidates.ts:350)。evidenceGain opp 同型 src/cards/ct-p01/B01069.ts。]

import type { AbilityDef, CardDef } from '@/engine/types';
import { partnerColorKeyword } from '@/cards/_shared';

const a1: AbilityDef = partnerColorKeyword({
  color: '赤',
  kw: '突撃[事件]',
  abilityId: 'a1'
});

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-scene',
  trigger: {
    hook: 'enter',
    selfOnly: true
  },
  effect: {
    kind: 'optional',
    effect: {
      kind: 'sequence',
      steps: [
        {
          kind: 'atom',
          verb: 'evidenceGain',
          args: {
            player: 'opp',
            n: 1
          }
        },
        {
          kind: 'atom',
          verb: 'sceneRemove',
          args: {
            player: 'self',
            max: 1,
            side: 'either',
            cause: 'effect',
            filter: {
              levelMax: 7
            }
          }
        }
      ]
    }
  },
  description: '【登場時】相手に証拠を1つ与えてもよい。そうした場合、レベル7以下のキャラを1枚まで選び、リムーブする。',
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md'
  ]
};

export const B03066: CardDef = {
  id: 'B03066',
  no: '0320/B03066',
  kind: 'character',
  names: [
    '赤井秀一'
  ],
  colors: [
    '赤'
  ],
  level: 8,
  ap: 7000,
  lp: 2,
  traits: [
    'FBI',
    '赤井家'
  ],
  rarity: 'SR',
  imageUrl: '1729133406830635.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md'
  ],
};
