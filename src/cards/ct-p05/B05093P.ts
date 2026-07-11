// cards/ct-p05/B05093P 榎本梓 (character, parallel) — WC2a: pick chooser 'opp-of-owner' 実配線 (2026-07-11)
// テキスト・能力は B05093 と同一 (パラレル: rarity CP / imageUrl のみ差)。句マッピングは B05093.ts 参照。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'enter', selfOnly: true }, // 【登場時】
  effect: {
    kind: 'sequence',
    steps: [
      { kind: 'atom', verb: 'deckRevealUntil', args: { player: 'self', maxN: 3, bind: '$revealed' } },
      {
        kind: 'atom',
        verb: 'handAddFromDeck',
        args: {
          player: 'self',
          cardId: '$pick.cardId',
          target: {
            kind: 'pick',
            query: {
              area: 'deck',
              side: 'self',
              fromGroupCards: '$revealed',
              filterAny: [{ kind: 'event' }, { kind: 'character', trait: '喫茶ポアロ' }],
            },
            n: { min: 1, max: 1 },
            chooser: 'opp-of-owner',
          },
        },
      },
      { kind: 'atom', verb: 'deckToBottomBound', args: { player: 'self', bindKey: '$revealed' } },
    ],
  },
  description:
    '【登場時】自分のデッキの上から3枚公開 → 相手がイベントか[喫茶ポアロ]キャラを1枚選び自分が手札に加える → 残りをデッキの下へ。',
  ruleRefs: [
    'rules/12-next-hint.md',
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/26-qa-deck-refresh.md',
  ],
};

export const B05093P: CardDef = {
  id: 'B05093P',
  no: '0591/B05093P',
  kind: 'character',
  names: ['榎本梓'],
  colors: ['黄'],
  level: 4,
  ap: 3000,
  lp: 1,
  traits: ['喫茶ポアロ'],
  keywords: [],
  rarity: 'CP',
  imageUrl: '1747231546541725.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/12-next-hint.md',
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/26-qa-deck-refresh.md',
  ],
};
