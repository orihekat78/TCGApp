// cards/pr-01/PR135 灰原哀 (PR) — bounce batch #2 (a1 only)
// rules: 15-abilities-effects.md, 17-icons.md
//
// 公式テキスト:
//   【登場時】自分の現場にレベル6以上の〚カード名［阿笠博士］〛がいる場合、
//     相手の現場にいるレベル8以下のキャラを1枚まで選び、手札に移す。
//   【相手ターン中】【現場リムーブ時】自分のデッキのカードを上から〚カード名［阿笠博士］〛が
//     出るまで1枚ずつ公開し、それを手札に加える。残りの公開したカードをデッキの下に移し、
//     デッキをシャッフルする。
//
// a1: enter + 自陣 levelMin:6 阿笠博士 条件 → 相手 levelMax:8 を 1枚 bounce
// a2: DEFERRED (deckRevealUntil cardName + handAddFromDeck — 別 engine 拡張で可能、別バッチ)

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'enter', selfOnly: true },
  condition: {
    kind: 'sceneHas',
    query: { area: 'scene', side: 'self', filter: { cardName: '阿笠博士', levelMin: 6 } },
    nMin: 1,
  },
  effect: {
    kind: 'atom',
    verb: 'sceneToHand',
    args: { player: 'self', max: 1, side: 'opp', filter: { levelMax: 8 } },
  },
  description: '【登場時】自陣 lv6+ 阿笠博士で 相手 level≤8 を 1枚 bounce。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

export const PR135: CardDef = {
  id: 'PR135',
  no: '0620/PR135',
  kind: 'character',
  names: ['灰原哀'],
  colors: ['青'],
  level: 5, ap: 5000, lp: 1,
  traits: ['少年探偵団', '科学者'], keywords: [],
  rarity: 'PR',
  imageUrl: '1747874027837907.jpg',
  abilities: [a1],
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md'],
};
