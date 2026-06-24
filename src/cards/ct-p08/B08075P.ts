// cards/ct-p08/B08075P ブライダルは女が主役 (event・パラレル) — Task A green候補 (engine変更0, 手書き)
// rules: rules/13-keywords.md, rules/15-abilities-effects.md, rules/17-icons.md,
//        rules/20-color-and-switch.md, rules/14-refresh.md, rules/26-qa-deck-refresh.md
//
// 公式テキスト (B08075 と同一)。句マッピングは B08075.ts 参照。P 版差分は rarity / imageUrl / no のみ。

import type { AbilityDef, CardDef, Effect } from '@/engine/types';

const opt1 = (): Effect => ({
  kind: 'optional',
  effect: {
    kind: 'atom',
    verb: 'sceneSetState',
    args: {
      uid: '$pick',
      state: 'active',
      target: { kind: 'pick', query: { area: 'scene', side: 'self', filter: { cardName: '佐藤美和子' } }, n: { min: 0, max: 1 }, chooser: 'self' },
    },
  },
});

const opt2 = (): Effect => ({
  kind: 'optional',
  effect: {
    kind: 'atom',
    verb: 'charGrantKeyword',
    args: {
      uid: '$pick',
      kw: '突撃[キャラ]',
      scope: 'turn',
      target: { kind: 'pick', query: { area: 'scene', side: 'self', filter: { cardName: '高木渉' } }, n: { min: 0, max: 1 }, chooser: 'self' },
    },
  },
});

const opt3 = (): Effect => ({
  kind: 'optional',
  effect: {
    kind: 'sequence',
    steps: [
      {
        kind: 'atom',
        verb: 'deckRevealUntil',
        args: {
          chooseMatch: 'upTo',
          player: 'self',
          filterAny: [
            { cardName: '佐藤美和子', kind: 'character' },
            { cardName: '高木渉', kind: 'character' },
          ],
          maxN: 4,
          bind: '$revealed',
          bindMatch: '$matched',
        },
      },
      {
        kind: 'conditional',
        if: { kind: 'bound', key: '$matched', presence: 'matched' },
        then: { kind: 'atom', verb: 'handAddFromDeck', args: { player: 'self', cardId: '$matched.cardId' } },
      },
      { kind: 'atom', verb: 'deckToBottomBound', args: { player: 'self', bindKey: '$revealed' } },
    ],
  },
});

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-hand',
  trigger: { hook: 'effect:declared', selfOnly: true, matcher: (p: unknown) => (p as { kind?: unknown })?.kind === 'event-use' },
  effect: { kind: 'sequence', steps: [opt1(), opt2(), opt3()] },
  description:
    '以下から3つまで選んで行う。（上から順に行う）・〚カード名［佐藤美和子］〛を1枚まで選びアクティブに。・〚カード名［高木渉］〛を1枚まで選びターン終了まで〚突撃［キャラ］〛付与。・デッキ上4枚を見て〚佐藤美和子］か〚高木渉］を1枚まで手札に加え、残りをデッキの下に移す。',
  ruleRefs: [
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/20-color-and-switch.md',
    'rules/26-qa-deck-refresh.md',
  ],
};

export const B08075P: CardDef = {
  id: 'B08075P',
  no: '0912/B08075P',
  kind: 'event',
  names: ['ブライダルは女が主役'],
  colors: ['黄'],
  level: 5,
  traits: [],
  rarity: 'CP',
  imageUrl: '1770878984811843.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/13-keywords.md',
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/20-color-and-switch.md',
    'rules/26-qa-deck-refresh.md',
  ],
};
