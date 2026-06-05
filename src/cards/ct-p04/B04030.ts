// cards/ct-p04/B04030 黒羽快斗 (キャラ) — engine-extension #1 leave:to-remove batch #2 (a2 only)
// rules: 15-abilities-effects.md, 17-icons.md, 24-qa-naming-stun.md
//
// 公式テキスト:
//   このキャラのアクション終了時、自分のデッキのカードを上から4枚見る。
//   その中からレベル8以下の〚カード名［怪盗キッド］〛のキャラを1枚まで公開し、残りを好きな順番でデッキの下に移す。
//   公開したキャラを手札に加えるか、公開したキャラを登場させてこのキャラをリムーブする。
//   【相手ターン中】【現場リムーブ時】レベル8以下のキャラを1枚まで選び、スタンさせる。
//
// a1: DEFERRED (action 終了時 deck-look-4 + choice + 自己リムーブ — 複雑)
// a2: leave:to-remove + turn=opp gate で level≤8 をスタン (state filter なし、active/sleep どちらも対象)

import type { AbilityDef, CardDef } from '@/engine/types';

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
  abilities: [a2],
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md'],
};
