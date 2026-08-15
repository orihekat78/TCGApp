// cards/ct-d01/D01012 灰原哀 (キャラ) — engine-extension look-top-N batch (2026-06-06 タスクC)
// rules: 03-field-areas.md, 10-action-event.md, 11-reasoning.md, 14-refresh.md, 15-abilities-effects.md, 17-icons.md, 26-qa-deck-refresh.md
//
// 公式テキスト:
//   【相手ターン中】【現場リムーブ時】自分のデッキのカードを上から3枚見る。
//     その中からレベル4以下の【青】のキャラを1枚までスリープ状態で登場させ、残りを好きな順番でデッキの下に移す。
//   【ヒラメキ】（証拠からリムーブされるときに発動する）キャラを1枚まで選び、スリープさせる。
//
// a1: 【相手ターン中】【現場リムーブ時】(leave:to-remove selfOnly + condition turn:opp) → look-top-N:
//   1) deckRevealUntil chooseMatch='upTo' maxN=3 filter={color:'青', levelMax:4, kind:'character'} → $matched + $revealed
//   2) conditional ($matched) → sceneEnter (from deck, enterSleep:true = スリープ状態で登場)
//   3) deckToBottomBound $revealed (残りをデッキ下へ)
// a2: 【ヒラメキ】キャラを1枚まで選び、スリープさせる (D08019 a2 同型 hirameki char-pick)。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  // 【現場リムーブ時】(このキャラ自身がリムーブされたとき)
  trigger: { hook: 'leave:to-remove', selfOnly: true },
  // 【相手ターン中】
  condition: { kind: 'turn', player: 'opp' },
  effect: {
    kind: 'sequence',
    steps: [
      // デッキ上から 3 枚見る — レベル4以下【青】キャラを $matched に bind
      {
        kind: 'atom',
        verb: 'deckRevealUntil',
        args: { chooseMatch: 'upTo', player: 'self', filter: { color: '青', levelMax: 4, kind: 'character' }, maxN: 3, bind: '$revealed', bindMatch: '$matched' },
      },
      // 該当があれば スリープ状態で登場 (enterSleep:true)
      {
        kind: 'conditional',
        if: { kind: 'bound', key: '$matched', presence: 'matched' },
        then: {
          kind: 'atom',
          verb: 'sceneEnter',
          args: { player: 'self', cardId: '$matched.cardId', viaEffect: true, enterSleep: true, target: { query: { area: 'deck', side: 'self' } } },
        },
      },
      // 残りをデッキの下へ
      { kind: 'atom', verb: 'deckToBottomBound', args: { player: 'self', bindKey: '$revealed' } },
    ],
  },
  description:
    '【相手ターン中】【現場リムーブ時】デッキ上3枚からレベル4以下の【青】キャラを1枚までスリープ状態で登場、残りデッキ下。',
  ruleRefs: ['rules/03-field-areas.md', 'rules/14-refresh.md', 'rules/17-icons.md', 'rules/26-qa-deck-refresh.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-evidence',
  trigger: { hook: 'evidence:remove-by-action', optional: true },
  // キャラを1枚まで選び、スリープさせる
  effect: {
    kind: 'atom',
    verb: 'sceneSetState',
    args: {
      uid: '$pick',
      state: 'sleep',
      target: { kind: 'pick', query: { area: 'scene', side: 'either' }, n: { min: 0, max: 1 }, chooser: 'self' },
    },
  },
  description: '【ヒラメキ】キャラを1枚まで選び、スリープさせる。',
  ruleRefs: ['rules/10-action-event.md', 'rules/03-field-areas.md'],
};

export const D01012: CardDef = {
  id: 'D01012',
  no: '0101/D01012',
  kind: 'character',
  names: ['灰原哀'],
  colors: ['青'],
  level: 5,
  ap: 5000,
  lp: 1,
  traits: ['少年探偵団', '科学者'],
  keywords: [],
  rarity: 'D',
  imageUrl: '1714013100425120.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/10-action-event.md',
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/26-qa-deck-refresh.md',
  ],
};
