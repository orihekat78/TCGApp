// cards/ct-d11/D11020 18の想起 (イベント)
// rules: 03-field-areas.md, 15-abilities-effects.md, 19-special-rules.md, 20-color-and-switch.md
// spec: .claude/specs/cards-analysis/D11020.md
//
// 公式テキスト:
//   レベル7以下のスリープ状態のキャラを1枚まで選び、リムーブする。
//   自分のリムーブエリアに〚特徴［神奈川県警］〛のキャラが3枚以上ある場合、
//   AP8000以下のキャラを1枚まで選び、リムーブする。
//
// 公式テキスト動詞 = atom (sceneRemove 短縮形 + conditional)。
// pick query は engine 既定で推論 (D08003 a1 step 2 と同パターン)。

import type { AbilityDef, CardDef, GameState } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-hand',
  trigger: {
    hook: 'effect:declared',
    selfOnly: true,
    matcher: (p: unknown, _s: GameState) => (p as { kind?: unknown })?.kind === 'event-use',
  },
  effect: {
    kind: 'sequence',
    steps: [
      // レベル7以下のスリープ状態のキャラを1枚まで選び、リムーブする
      { kind: 'atom', verb: 'sceneRemove', args: { player: 'self', max: 1, side: 'either', filter: { levelMax: 7 }, state: ['sleep'] } },
      { kind: 'conditional',
        // 自分のリムーブエリアに[神奈川県警]のキャラが3枚以上ある場合
        if: { kind: 'removeTraitAtLeast', player: 'self', trait: '神奈川県警', n: 3 },
        // AP8000以下のキャラを1枚まで選び、リムーブする
        then: { kind: 'atom', verb: 'sceneRemove', args: { player: 'self', max: 1, side: 'either', filter: { apMax: 8000 } } },
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
