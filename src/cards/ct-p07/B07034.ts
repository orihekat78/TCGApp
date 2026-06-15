// cards/ct-p07/B07034 小泉紅子 (character) — engine拡張 wave#2 cluster9 (setcard:leave hook)
// rules: 11-reasoning.md, 13-keywords.md, 15-abilities-effects.md, 16-card-set.md, 17-icons.md, 21-declared-ability-cost.md
//
// 公式テキスト:
//   【事件赤魔術】【自分ターン中】【ターン2】自分の現場にいるキャラに裏向きでセットされているカードが
//     1枚現場から離れるたび、カードを1枚引く。
//   【宣言】【スリープ】〚手札を1枚リムーブする〛：自分のデッキのカードを上から1枚裏向きでこのキャラに
//     セットする。レベル7以下のキャラを1枚まで選び、リムーブする。
// 公式Q&A (a1):
//   - 自分の現場のキャラが現場を離れ、それにより裏向きセットがリムーブされたときも発動。
//   - このキャラ自身が現場を離れた / 同時に離れた場合も (【ターン2】範囲内で) 発動。
//   - 2枚以上同時に離れたら 1枚につき1回、上限2回まで同時発動。
//   - 【事件赤魔術】= 自分の事件が特徴[赤魔術]を持つ場合に有効。
// 公式Q&A (a2): コスト「手札を1枚リムーブ」は自分のカードのみ (rules/21)。
//
// 句マッピング (cluster9 design-review: GO / 0 blockers / 全句意味等価):
//   - a1 = trigger{hook:'setcard:leave', matcherCondition:triggerPlayerIs side:self} (自分の現場キャラ=自側)
//     · condition = and[caseTrait赤魔術 (【事件赤魔術】), turn:self (【自分ターン中】)]
//     · limit = {turn, n:2} (【ターン2】)。per-occurrence emit + limit で「1枚につき1回・上限2」を構造保証。
//     · effect = draw 1。
//   - a2 = declared, cost pay[sleepSelf, removeFromHand n:1] (B01088/B07031 同型、両払えねば宣言不可 rules/21)。
//     · effect = sequence[ charSetCard{uid:$self, fromDeckTop, faceUp:false} (デッキ上端を裏向きでこのキャラに),
//                          sceneRemove{max:1, side:either, filter:levelMax7} (レベル7以下1枚まで、0枚可 rules/15) ]。
//
// known-gap (cluster9 design-review、本カード起因ではない engine 制約。DEFERRED-INDEX 記録):
//   - FIX-3 「裏向き」filter: 全 charSetCard atom が faceUp:false = face-up set card は現状 0 枚のため、
//     faceUp filter 無し (= 任意 set card 反応) は **vacuously 等価**。payload は faceUp を運ぶため、
//     将来 face-up set card 追加時に matcherCondition 1 行で filter 追加可 (engine 変更不要)。
//   - FIX-2 cross-char 同時離場の順序依存: engine は atomic な複数キャラ同時リムーブを持たず逐次。
//     listener (このキャラ) が sibling より **先に** splice されると sibling の set card 離場では発火しない
//     (self-leave 単体 / 1キャラ複数 set card は正)。leave:to-remove と同じ engine-wide 性質。

import type { AbilityDef, CardDef } from '@/engine/types';

// a1: 【事件赤魔術】【自分ターン中】【ターン2】自側キャラの (裏向き)セットカードが1枚離れるたび、1ドロー。
const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  // 「自分の現場にいるキャラに…セットされているカードが離れるたび」= 自側 set card 離場 (triggerPlayerIs side:self)
  trigger: { hook: 'setcard:leave', matcherCondition: { kind: 'triggerPlayerIs', side: 'self' } },
  // 【事件赤魔術】(自分の事件が特徴[赤魔術]) + 【自分ターン中】
  condition: { kind: 'and', cs: [{ kind: 'caseTrait', trait: '赤魔術' }, { kind: 'turn', player: 'self' }] },
  limit: { kind: 'turn', n: 2 }, // 【ターン2】
  effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
  description: '【事件赤魔術】【自分ターン中】【ターン2】自分の現場のキャラの裏向きセットカードが1枚離れるたび、カードを1枚引く。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/16-card-set.md', 'rules/17-icons.md'],
};

// a2: 【宣言】【スリープ】〚手札1枚リムーブ〛 → このキャラにデッキ上端を裏向きセット + レベル7以下1枚までリムーブ。
const a2: AbilityDef = {
  id: 'a2',
  type: 'declared',
  scope: 'on-scene',
  // 【スリープ】〚手札を1枚リムーブする〛 (両コスト合成 / 一部でも払えねば宣言不可) — B01088/B07031 同型
  cost: {
    kind: 'pay',
    items: [
      { kind: 'sleepSelf' },
      { kind: 'removeFromHand', target: { kind: 'pick', query: { area: 'hand', side: 'self' }, n: { min: 1, max: 1 }, chooser: 'self' }, n: 1 },
    ],
  },
  effect: {
    kind: 'sequence',
    steps: [
      // 自分のデッキ上端を1枚裏向きでこのキャラにセット (B07031 a1 / B08054 a2 同型)
      { kind: 'atom', verb: 'charSetCard', args: { uid: '$self', fromDeckTop: true, faceUp: false, player: 'self' } },
      // レベル7以下のキャラを1枚まで選び、リムーブする (side:either・0枚可 rules/15)
      { kind: 'atom', verb: 'sceneRemove', args: { player: 'self', max: 1, side: 'either', filter: { levelMax: 7 } } },
    ],
  },
  description: '【宣言】【スリープ】〚手札1枚リムーブ〛：デッキ上端を裏向きでこのキャラにセット。レベル7以下のキャラを1枚までリムーブ。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/16-card-set.md', 'rules/17-icons.md', 'rules/21-declared-ability-cost.md'],
};

export const B07034: CardDef = {
  id: 'B07034',
  no: '0763/B07034',
  kind: 'character',
  names: ['小泉紅子'],
  colors: ['白'],
  level: 7,
  ap: 5000,
  lp: 1,
  traits: ['高校生', '魔女'],
  keywords: [],
  rarity: 'R',
  imageUrl: '1762413994228395.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/11-reasoning.md',
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/16-card-set.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md',
  ],
};
