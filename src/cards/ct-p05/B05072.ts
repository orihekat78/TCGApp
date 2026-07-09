// cards/ct-p05/B05072 沖矢昴 (character) — Task A green候補 (engine変更0)
// rules: rules/05-turn-phases.md, rules/15-abilities-effects.md, rules/19-special-rules.md
// 公式テキスト:
//   自分のターンのメインフェイズ開始時、手札を1枚リムーブしてもよい。そうした場合、自分のリムーブエリアにある〚カード名［赤井秀一］〛か〚［ライ］〛を1枚まで選び、手札に加える。
// 句マッピング:
//   - 自分のターンのメインフェイズ開始時、手札を1枚リムーブしてもよい。そうした場合、自分のリムーブエリアにある〚カード名［赤井秀一］〛か〚［ライ］〛を1枚まで選び、手札に加える => trigger phase:main:start + matcherCondition triggerPlayerIs self + chain[discard max1, handAddFromRemove max1 cardName[赤井秀一|ライ]] [phase:main:start = 本 wave TRIGGERED_HOOKS 追加 (emit は turn.ts 既存 = 公式Q&A のオートフェイズ完了後)。してもよい = discard max1 0-pick decline (PR006 idiom)。cardName 配列 any-match + 分割名 (赤井秀一＆沖矢昴も該当、公式Q&A・rules/19)]

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: {
    hook: 'phase:main:start',
    matcherCondition: {
      kind: 'triggerPlayerIs',
      side: 'self'
    }
  },
  effect: {
    kind: 'chain',
    steps: [
      {
        kind: 'atom',
        verb: 'discard',
        args: {
          player: 'self',
          max: 1
        }
      },
      {
        kind: 'atom',
        verb: 'handAddFromRemove',
        args: {
          player: 'self',
          max: 1,
          filter: {
            cardName: [
              '赤井秀一',
              'ライ'
            ]
          }
        }
      }
    ]
  },
  description: '自分のターンのメインフェイズ開始時、手札を1枚リムーブしてもよい。そうした場合、自分のリムーブエリアにある〚カード名［赤井秀一］〛か〚［ライ］〛を1枚まで選び、手札に加える。',
  ruleRefs: [
    'rules/05-turn-phases.md',
    'rules/15-abilities-effects.md',
    'rules/19-special-rules.md'
  ]
};

export const B05072: CardDef = {
  id: 'B05072',
  no: '0572/B05072',
  kind: 'character',
  names: [
    '沖矢昴'
  ],
  colors: [
    '赤'
  ],
  level: 5,
  ap: 5000,
  lp: 1,
  traits: [
    '大学院生'
  ],
  rarity: 'C',
  imageUrl: '1745322205587576.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/05-turn-phases.md',
    'rules/15-abilities-effects.md',
    'rules/19-special-rules.md'
  ],
};
