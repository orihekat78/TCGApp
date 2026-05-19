// cards/ct-d11/D11020 18の想起 (イベント)
// rules: 03-field-areas.md, 15-abilities-effects.md, 19-special-rules.md, 20-color-and-switch.md
// spec: .claude/specs/cards-analysis/D11020.md
//
// 公式テキスト:
//   レベル7以下のスリープ状態のキャラを1枚まで選び、リムーブする。
//   自分のリムーブエリアに〚特徴［神奈川県警］〛のキャラが3枚以上ある場合、
//   AP8000以下のキャラを1枚まで選び、リムーブする。
//
// a1: 個別実装 (sequence 2段)
//   ステップ1: level7以下 sleep キャラを 1枚まで リムーブ (eventRemoveByAP の filter は apMax のみ → 個別)
//   ステップ2: conditional(removeTraitAtLeast 神奈川県警 3+) → AP8000以下を 1枚まで リムーブ

import type { AbilityDef, CardDef, GameState } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-hand',
  trigger: {
    hook: 'effect:declared',
    selfOnly: true,
    matcher: (p: unknown, _s: GameState) => {
      if (!p || typeof p !== 'object') return false;
      return (p as { kind?: unknown }).kind === 'event-use';
    },
  },
  effect: {
    kind: 'sequence',
    steps: [
      {
        kind: 'choice',
        chooser: 'self',
        options: [
          {
            kind: 'atom',
            verb: 'sceneRemove',
            args: {
              uid: '$pick',
              cause: 'effect',
              target: {
                kind: 'pick',
                query: {
                  area: 'scene',
                  side: 'either',
                  filter: { levelMax: 7 },
                  state: ['sleep'],
                },
                n: { min: 0, max: 1 },
                chooser: 'self',
              },
            },
          },
        ],
      },
      {
        kind: 'conditional',
        if: {
          kind: 'removeTraitAtLeast',
          player: 'self',
          trait: '神奈川県警',
          n: 3,
        },
        then: {
          kind: 'choice',
          chooser: 'self',
          options: [
            {
              kind: 'atom',
              verb: 'sceneRemove',
              args: {
                uid: '$pick',
                cause: 'effect',
                target: {
                  kind: 'pick',
                  query: {
                    area: 'scene',
                    side: 'either',
                    filter: { apMax: 8000 },
                  },
                  n: { min: 0, max: 1 },
                  chooser: 'self',
                },
              },
            },
          ],
        },
      },
    ],
  },
  description:
    'レベル7以下スリープのキャラを1枚までリムーブ / リムーブに[神奈川県警]3+なら AP8000以下を1枚までリムーブ。',
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/19-special-rules.md',
  ],
};

export const D11020: CardDef = {
  id: 'D11020',
  no: '0945/D11020',
  kind: 'event',
  names: ['18の想起'],
  colors: ['黄'],
  level: 8,
  traits: [],
  rarity: 'D',
  imageUrl: '1775608977402003.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/15-abilities-effects.md',
    'rules/19-special-rules.md',
  ],
};
