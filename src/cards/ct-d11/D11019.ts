// cards/ct-d11/D11019 15の受難 (イベント)
// rules: 09-cutin-disguise.md, 13-keywords.md, 17-icons.md, 20-color-and-switch.md, 26-qa-deck-refresh.md
// spec: .claude/specs/cards-analysis/D11019.md
//
// 公式テキスト:
//   自分のデッキのカードを上からレベル4以下の【黄】のキャラが出るまで1枚ずつ公開し、それを登場させる。
//   残りの公開したカードをデッキの下に移し、デッキをシャッフルする。
//   自分のリムーブエリアに【黄】のカードが20枚以上ある場合、ターン終了時までそのキャラに〚突撃［事件］〛を持たせる。
//   【カットイン】AP＋1000
//
// a1: 個別実装 sequence (deckRevealUntil → conditional sceneEnter → deckToBottomBound → deckShuffle → conditional charGrantKeyword)
// a2: cutinFixedAP({ delta:1000 })

import type { AbilityDef, CardDef, GameState } from '@/engine/types';
import { cutinFixedAP } from '@/cards/_shared/cutinFixedAP';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-hand',
  trigger: {
    hook: 'effect:declared',
    matcher: (p: unknown, _s: GameState) => {
      if (!p || typeof p !== 'object') return false;
      return (p as { kind?: unknown }).kind === 'event-use';
    },
  },
  effect: {
    kind: 'sequence',
    steps: [
      {
        kind: 'atom',
        verb: 'deckRevealUntil',
        args: {
          player: 'self',
          filter: { color: '黄', levelMax: 4, kind: 'character' },
          bind: '$revealed',
          bindMatch: '$matched',
        },
      },
      {
        kind: 'conditional',
        if: { kind: 'bound', key: '$matched', presence: 'matched' },
        then: {
          kind: 'atom',
          verb: 'sceneEnter',
          args: {
            player: 'self',
            cardId: '$matched.cardId',
            viaEffect: true,
          },
        },
      },
      {
        kind: 'atom',
        verb: 'deckToBottomBound',
        args: { player: 'self', bindKey: '$revealed' },
      },
      {
        kind: 'atom',
        verb: 'deckShuffle',
        args: { player: 'self' },
      },
      {
        kind: 'conditional',
        if: {
          kind: 'and',
          cs: [
            { kind: 'bound', key: '$matched', presence: 'matched' },
            { kind: 'removeColorAtLeast', player: 'self', color: '黄', n: 20 },
          ],
        },
        then: {
          kind: 'atom',
          verb: 'charGrantKeyword',
          args: { uid: '$matched.uid', kw: '突撃[事件]', scope: 'turn' },
        },
      },
    ],
  },
  description:
    'デッキ上からレベル4以下【黄】のキャラまで公開→登場 / 残りはデッキ下 / リムーブ【黄】20以上で突撃[事件]を付与。',
  ruleRefs: [
    'rules/13-keywords.md',
    'rules/20-color-and-switch.md',
    'rules/26-qa-deck-refresh.md',
  ],
};

export const D11019: CardDef = {
  id: 'D11019',
  no: '0944/D11019',
  kind: 'event',
  names: ['15の受難'],
  colors: ['黄'],
  level: 4,
  traits: [],
  rarity: 'D',
  imageUrl: '1775608977394523.jpg',
  abilities: [a1, cutinFixedAP({ delta: 1000, abilityId: 'a2' })],
  ruleRefs: [
    'rules/09-cutin-disguise.md',
    'rules/13-keywords.md',
    'rules/20-color-and-switch.md',
    'rules/26-qa-deck-refresh.md',
  ],
};
