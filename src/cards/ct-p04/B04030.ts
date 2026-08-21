// cards/ct-p04/B04030 黒羽快斗 (キャラ) — engine-extension #1 leave:to-remove batch #2 (a2 only)
// rules: 15-abilities-effects.md, 17-icons.md, 24-qa-naming-stun.md
//
// 公式テキスト:
//   このキャラのアクション終了時、自分のデッキのカードを上から4枚見る。
//   その中からレベル8以下の〚カード名［怪盗キッド］〛のキャラを1枚まで公開し、残りを好きな順番でデッキの下に移す。
//   公開したキャラを手札に加えるか、公開したキャラを登場させてこのキャラをリムーブする。
//   【相手ターン中】【現場リムーブ時】レベル8以下のキャラを1枚まで選び、スタンさせる。
//
// a1: action-end deck-look-4 + choice + successful enter-only source removal.
// a2: leave:to-remove + turn=opp gate で level≤8 をスタン (state filter なし、active/sleep どちらも対象)

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'action:end', selfOnly: true },
  effect: {
    kind: 'sequence',
    steps: [
      { kind: 'atom', verb: 'deckRevealUntil', args: { player: 'self', maxN: 4, chooseMatch: 'upTo', visibility: 'private', viewer: 'self', filter: { cardName: '怪盗キッド', levelMax: 8, kind: 'character' }, bind: '$revealed', bindMatch: '$matched' } },
      { kind: 'conditional', if: { kind: 'bound', key: '$matched', presence: 'matched' }, then: { kind: 'choice', chooser: 'self', options: [
        { kind: 'atom', verb: 'handAddFromDeck', args: { player: 'self', cardId: '$matched.cardId' } },
        { kind: 'sequence', steps: [
          { kind: 'atom', verb: 'sceneEnter', args: { player: 'self', cardId: '$matched.cardId', viaEffect: true, bind: '$entered', target: { query: { area: 'deck', side: 'self' } } } },
          { kind: 'conditional', if: { kind: 'bound', key: '$entered', presence: 'matched' }, then: { kind: 'atom', verb: 'sceneRemove', args: { uid: '$self', cause: 'effect' } } },
        ] },
      ] } },
      { kind: 'atom', verb: 'deckToBottomBound', args: { player: 'self', bindKey: '$revealed' } },
    ],
  },
  description: 'このキャラのアクション終了時、自分のデッキのカードを上から4枚見る。その中からレベル8以下の〚カード名［怪盗キッド］〛のキャラを1枚まで公開し、残りを好きな順番でデッキの下に移す。公開したキャラを手札に加えるか、公開したキャラを登場させてこのキャラをリムーブする。',
  ruleRefs: ['rules/07-action-flow.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/20-color-and-switch.md', 'rules/22-qa-action-contact.md', 'rules/26-qa-deck-refresh.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'leave:to-remove', selfOnly: true },
  condition: { kind: 'turn', player: 'opp' },
  effect: {
    kind: 'atom',
    verb: 'sceneSetState',
    args: { player: 'self', max: 1, side: 'either', state: 'stun', filter: { levelMax: 8 } },
  },
  description: '【相手ターン中】【現場リムーブ時】レベル8以下のキャラを1枚までスタン。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

export const B04030: CardDef = {
  id: 'B04030',
  no: '0428/B04030',
  kind: 'character',
  names: ['黒羽快斗'],
  colors: ['白'],
  level: 8, ap: 7000, lp: 1,
  traits: ['高校生', 'マジシャン'], keywords: [],
  rarity: 'SR',
  imageUrl: '1735287759446337.jpg',
  abilities: [a1, a2],
  ruleRefs: ['rules/07-action-flow.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/20-color-and-switch.md', 'rules/22-qa-action-contact.md', 'rules/26-qa-deck-refresh.md'],
};
