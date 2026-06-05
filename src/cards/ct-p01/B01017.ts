// cards/ct-p01/B01017 本堂瑛祐 (キャラ) — engine-extension reasoning-hook batch (2026-06-06 タスクC)
// rules: 11-reasoning.md, 14-refresh.md, 15-abilities-effects.md, 17-icons.md, 26-qa-deck-refresh.md
//
// 公式テキスト:
//   このキャラが推理したとき、自分のデッキのカードを上から2枚見る。
//     その中から〚特徴［探偵］〛のキャラを1枚まで公開して手札に加え、残りを好きな順番でデッキの下に移す。
//
// a1: 推理反応 (reasoning:end selfOnly = このキャラが推理したとき) → deck-look-N (D01013 同型):
//   1) deckRevealUntil maxN=2 filter={trait:'探偵', kind:'character'} → $matched (探偵キャラ1枚 or 空) + $revealed
//      ※ kind:'character' は「[探偵]のキャラ」(イベント除外、BUG-123 教訓)。
//   2) conditional ($matched present) → handAddFromDeck($matched.cardId)  (discard 連鎖なし)
//   3) deckToBottomBound $revealed (残りをデッキ下へ)

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  // このキャラが推理したとき (reasoning:end、source.uid 一致でこのキャラ自身の推理のみ発火)
  trigger: { hook: 'reasoning:end', selfOnly: true },
  effect: {
    kind: 'sequence',
    steps: [
      // デッキ上から 2 枚見る (maxN=2) — [探偵] キャラに該当する 1 枚を $matched に bind
      {
        kind: 'atom',
        verb: 'deckRevealUntil',
        args: {
          player: 'self',
          filter: { trait: '探偵', kind: 'character' },
          maxN: 2,
          bind: '$revealed',
          bindMatch: '$matched',
        },
      },
      // 該当があれば手札に加える (discard 連鎖なし)
      {
        kind: 'conditional',
        if: { kind: 'bound', key: '$matched', presence: 'matched' },
        then: { kind: 'atom', verb: 'handAddFromDeck', args: { player: 'self', cardId: '$matched.cardId' } },
      },
      // 残りのカードをデッキの下へ
      { kind: 'atom', verb: 'deckToBottomBound', args: { player: 'self', bindKey: '$revealed' } },
    ],
  },
  description:
    'このキャラが推理したとき、デッキ上から2枚見る → [探偵]のキャラを1枚まで手札に加え、残りをデッキ下。',
  ruleRefs: [
    'rules/11-reasoning.md',
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/26-qa-deck-refresh.md',
  ],
};

export const B01017: CardDef = {
  id: 'B01017',
  no: '0013/B01017',
  kind: 'character',
  names: ['本堂瑛祐'],
  colors: ['青'],
  level: 4,
  ap: 4000,
  lp: 1,
  traits: ['高校生'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1714012985519341.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/11-reasoning.md',
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/26-qa-deck-refresh.md',
  ],
};
