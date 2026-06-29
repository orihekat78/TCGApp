// cards/ct-p03/B03066P 赤井秀一 (キャラ・パラレル) — ENGINE0 wave (engine変更0)
// rules: rules/13-keywords.md, rules/15-abilities-effects.md, rules/17-icons.md
//
// 公式テキスト (B03066 と同一効果。P 版は cardNum / rarity / imageUrl のみ異なる):
//   【パートナー赤】〚突撃［事件］〛
//   【登場時】相手に証拠を1つ与えてもよい。そうした場合、レベル7以下のキャラを1枚まで選び、リムーブする。
// 句マッピングは B03066.ts と同一 (同テキスト別ファイル full def 慣行 — B09096P 同様)。

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

export const B03066P: CardDef = {
  id: 'B03066P',
  no: '0320/B03066P',
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
  rarity: 'SRP',
  imageUrl: '1729133406836921.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md'
  ],
};
