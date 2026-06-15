// cards/ct-p02/B02020 大岡紅葉 (キャラ) — a1 解禁 (engine拡張 wave#2 cluster9 setcard:leave hook) + a2
// rules: 15-abilities-effects.md, 16-card-set.md, 17-icons.md
//
// 公式テキスト:
//   【自分ターン中】【ターン1】相手の現場にいるキャラにセットされているカードが現場から離れたとき、
//     自分の現場にいるキャラを1枚まで選び、自分のデッキのカードを上から1枚裏向きでセットする。
//     カードを1枚引く。
//   【登場時】相手の現場にいるキャラを1枚まで選び、相手のデッキのカードを上から1枚裏向きでセットする。
//
// 句マッピング (cluster9 design-review: GO / 全句意味等価):
//   a1 (公式テキスト 1 行目): 【自分ターン中】【ターン1】相手側キャラの set card 離場 →
//     自側キャラ1枚までにデッキ上端を裏向きセット + 1ドロー。
//     · trigger{hook:'setcard:leave', matcherCondition:triggerPlayerIs side:'opp'} (相手の現場キャラ=相手側)
//     · condition turn:self (【自分ターン中】) / limit {turn, n:1} (【ターン1】)
//     · effect sequence[ charSetCard{player:self, side:self, max:1, fromDeckTop, faceUp:false} (自側1枚まで・0枚可),
//                        draw 1 (set 0枚でも引く=別文) ]
//     · 公式Q&A: 相手キャラ離場でその set card が離れたときも発動 / 「代わりにセット」(置換) は不発動
//       (engine の set 操作は push のみ・置換 path 無しで構造的に成立)。
//   a2 (公式テキスト 2 行目): enter + 相手 1pick + opp-デッキ上端裏向きセット
//     (charSetCard PA短縮形 で player:'opp' + side:'opp' で opp 側 deck + opp 側 char に set)
// known-gap (cluster9 design-review、engine 制約・本カード起因ではない): B02020 a1 は「セットされているカード」
//   = 任意 (裏向き/表向き) だが face-up set card は現状 0 枚で差異なし。cross-char 同時離場の順序依存は
//   leave:to-remove 同様 (DEFERRED-INDEX 記録)。

import type { AbilityDef, CardDef } from '@/engine/types';

// a1: 【自分ターン中】【ターン1】相手側キャラの set card 離場 → 自側1枚までデッキ上端裏向きセット + 1ドロー。
const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  // 「相手の現場にいるキャラに…セットされているカードが離れたとき」= 相手側 set card 離場 (triggerPlayerIs side:opp)
  trigger: { hook: 'setcard:leave', matcherCondition: { kind: 'triggerPlayerIs', side: 'opp' } },
  condition: { kind: 'turn', player: 'self' }, // 【自分ターン中】
  limit: { kind: 'turn', n: 1 }, // 【ターン1】
  effect: {
    kind: 'sequence',
    steps: [
      // 自分の現場のキャラを1枚まで選び、自分のデッキ上端を裏向きセット (0枚可 rules/15)
      { kind: 'atom', verb: 'charSetCard', args: { player: 'self', max: 1, side: 'self', fromDeckTop: true, faceUp: false } },
      // カードを1枚引く (別文 = set 0枚でも実行)
      { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
    ],
  },
  description: '【自分ターン中】【ターン1】相手の現場のキャラのセットカードが離れたとき、自分のキャラ1枚までにデッキ上端を裏向きセット。カードを1枚引く。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/16-card-set.md', 'rules/17-icons.md'],
};

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
  abilities: [a1, a2],
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/16-card-set.md', 'rules/17-icons.md'],
};
