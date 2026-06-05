// cards/ct-p02/B02020 大岡紅葉 (キャラ) — set-card batch #2 (a2 only)
// rules: 15-abilities-effects.md, 16-card-set.md, 17-icons.md
//
// 公式テキスト:
//   【自分ターン中】【ターン1】相手の現場にいるキャラにセットされているカードが現場から離れたとき、
//     自分の現場にいるキャラを1枚まで選び、自分のデッキのカードを上から1枚裏向きでセットする。
//     カードを1枚引く。
//   【登場時】相手の現場にいるキャラを1枚まで選び、相手のデッキのカードを上から1枚裏向きでセットする。
//
// a1: DEFERRED (set-card-leave hook 未対応)
// a2 (公式テキスト 2 行目): enter + 相手 1pick + opp-デッキ上端裏向きセット
//   (charSetCard PA短縮形 で player:'opp' + side:'opp' で opp 側 deck + opp 側 char に set)

import type { AbilityDef, CardDef } from '@/engine/types';

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'enter', selfOnly: true },
  effect: {
    kind: 'atom',
    verb: 'charSetCard',
    args: { player: 'opp', max: 1, side: 'opp', fromDeckTop: true, faceUp: false },
  },
  description: '【登場時】相手キャラ1枚に 相手デッキ上端を裏向きセット。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/16-card-set.md', 'rules/17-icons.md'],
};

export const B02020: CardDef = {
  id: 'B02020',
  no: '0190/B02020',
  kind: 'character',
  names: ['大岡紅葉'],
  colors: ['緑'],
  level: 6, ap: 5000, lp: 1,
  traits: ['高校生'], keywords: [],
  rarity: 'SR',
  imageUrl: '1721357188625094.jpg',
  abilities: [a2],
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/16-card-set.md', 'rules/17-icons.md'],
};
