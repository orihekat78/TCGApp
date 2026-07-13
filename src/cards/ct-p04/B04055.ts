// rules: 15-abilities-effects.md, 25-qa-effects-resolution.md
// 【相手ターン中】【ターン1】自分の現場にいるこのキャラ以外の【赤】のキャラが
// リムーブされたとき、このキャラがスリープ状態で現場にいる場合、自分のデッキの
// カードを上から1枚公開する。同じ特徴を持つ場合は手札へ、それ以外はデッキの下へ。
import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'leave:to-remove' },
  condition: {
    kind: 'and',
    cs: [
      { kind: 'turn', player: 'opp' },
      { kind: 'sourceInScene' },
      { kind: 'charStateIs', ref: { kind: 'self' }, state: 'sleep' },
      { kind: 'removedCharMatches', side: 'self', removedFilter: { color: '赤' } },
    ],
  },
  limit: { kind: 'turn', n: 1 },
  effect: {
    kind: 'sequence',
    steps: [
      {
        kind: 'atom', verb: 'deckRevealUntil',
        args: {
          player: 'self', maxN: 1,
          filter: { traitSharedWithTriggerRemoved: true },
          bind: '$revealed', bindMatch: '$matched',
        },
      },
      {
        kind: 'conditional', if: { kind: 'bound', key: '$matched', presence: 'matched' },
        then: { kind: 'atom', verb: 'handAddFromDeck', args: { player: 'self', cardId: '$matched.cardId' } },
      },
      { kind: 'atom', verb: 'deckToBottomBound', args: { player: 'self', bindKey: '$revealed' } },
    ],
  },
  description: '【相手ターン中】【ターン1】自分の現場にいるこのキャラ以外の【赤】のキャラがリムーブされたとき、このキャラがスリープ状態で現場にいる場合、自分のデッキのカードを上から1枚公開する。公開したカードがリムーブされたキャラのいずれかと同じ特徴を持つ場合、手札に加える。公開したカードがそれ以外の場合、デッキの下に移す。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/25-qa-effects-resolution.md'],
};

export const B04055: CardDef = {
  id: 'B04055', no: '0447/B04055', kind: 'character',
  names: ['アマンダ・ヒューズ'], colors: ['赤'], level: 3, ap: 3000, lp: 1,
  traits: [], rarity: 'C', imageUrl: '1735287801229955.jpg', abilities: [a1],
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/25-qa-effects-resolution.md'],
};
