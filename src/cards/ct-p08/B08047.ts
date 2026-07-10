// cards/ct-p08/B08047 沖矢昴 (character) — M2後半 mini-wave (removeFromHandDownTo cost) 同梱 exemplar
// rules: rules/05-turn-phases.md, rules/14-refresh.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/21-declared-ability-cost.md
// 公式テキスト:
//   自分のターン終了時、自分の手札が2枚になるまでカードを引く。
//   【パートナー赤】【宣言】【スリープ】〚手札が2枚になるまで手札をリムーブする〛：キャラを1枚まで選び、リムーブする。
// 公式QA:
//   - 「この能力は、手札が2枚以下でも宣言できますか？」→ はい。その場合コストは【スリープ】だけ
//     (removeFromHandDownTo canPay 恒真 = cost/evaluate.ts:150-152、支払枚数 0 で成立)
// 句マッピング:
//   - 自分のターン終了時 => trigger:{hook:'phase:end:start'} + condition:{kind:'turn', player:'self'}
//     [VERBATIM D03011.ts a1 / B05087.ts a2。「自分の」指定あり → turn:self gate 必須
//     (gate 無しの「ターン終了時」= B03014 は相手ターン終了時も発火する対比、grounding 罠節)。
//     phase:end:start は turn.ts:72 が clearTurnEffects より前に emit — draw はターン終了時能力窓で解決]
//   - 自分の手札が2枚になるまでカードを引く => atom drawUpToHandSize{player:'self', n:2}
//     [engine dormant verb (core.ts atomDrawUpToHandSize、本カード名指しの motivating card)。
//     draw(max(0, 2−hand))、手札≥2 なら draw 0。デッキ枯渇は mutate.deck.draw が refresh 内蔵 (rules/14)]
//   - 【パートナー赤】 => condition {kind:'partnerColor', color:'赤'} [VERBATIM B01009.ts a1 (青→赤)]
//   - 【宣言】 => type:'declared' [B01009.ts a2]
//   - 【スリープ】 => cost items {kind:'sleepSelf'} [VERBATIM B03060.ts a1]
//   - 〚手札が2枚になるまで手札をリムーブする〛 => cost items {kind:'removeFromHandDownTo', n:2}
//     [engine M2後半 primitive (effect.ts:589 / evaluate.ts:150 / pay.ts:342)。count=max(0,hand−2)、
//     viaCost で hand:removed 非 emit (rules/21 コストは「効果によって」条件を満たさない)]
//   - キャラを1枚まで選び、リムーブする => sceneRemove 短縮形 {player:'self', side:'either', max:1,
//     filter:{kind:'character'}} [短縮形 = B05087.ts a1 同型。エリア/側 指定なし「キャラ」= どちらの現場でも
//     (rules/15) → side:'either'。「1枚まで」= 0枚可 → max:1]

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  // 自分のターン終了時 (相手ターン終了時は不発 — turn:self gate)
  trigger: { hook: 'phase:end:start' },
  condition: { kind: 'turn', player: 'self' },
  // 自分の手札が2枚になるまでカードを引く (手札≥2 なら 0 枚)
  effect: { kind: 'atom', verb: 'drawUpToHandSize', args: { player: 'self', n: 2 } },
  description: '自分のターン終了時、自分の手札が2枚になるまでカードを引く。',
  ruleRefs: ['rules/05-turn-phases.md', 'rules/14-refresh.md', 'rules/15-abilities-effects.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'declared',
  scope: 'on-scene',
  // 【パートナー赤】
  condition: { kind: 'partnerColor', color: '赤' },
  // 【スリープ】〚手札が2枚になるまで手札をリムーブする〛 (手札2枚以下でも宣言可 — 公式QA、canPay 恒真)
  cost: {
    kind: 'pay',
    items: [{ kind: 'sleepSelf' }, { kind: 'removeFromHandDownTo', n: 2 }],
  },
  // キャラを1枚まで選び、リムーブする (side 指定なし = either、0枚可)
  effect: {
    kind: 'atom',
    verb: 'sceneRemove',
    args: { player: 'self', side: 'either', max: 1, filter: { kind: 'character' } },
  },
  description:
    '【パートナー赤】【宣言】【スリープ】〚手札が2枚になるまで手札をリムーブする〛：キャラを1枚まで選び、リムーブする。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/21-declared-ability-cost.md'],
};

export const B08047: CardDef = {
  id: 'B08047',
  no: '0885/B08047',
  kind: 'character',
  names: ['沖矢昴'],
  colors: ['赤'],
  level: 7,
  ap: 5000,
  lp: 1,
  traits: ['大学院生'],
  keywords: [],
  rarity: 'SR',
  imageUrl: '1770731222641622.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/05-turn-phases.md',
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md',
  ],
};
