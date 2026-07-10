// cards/ct-p08/B08057 宮野エレーナ (character) — S2 deck cluster (remove→deck-bottom 3-tier pick, 2026-07-10)
// rules: 14-refresh.md, 15-abilities-effects.md, 17-icons.md, 19-special-rules.md,
//        21-declared-ability-cost.md, 26-qa-deck-refresh.md
//
// 公式テキスト:
//   【解決編】現場にいるこのキャラをレベル＋2する。
//   【解決編】【宣言】【ターン1】【スリープ】〚デッキのカードを上から9枚リムーブする〛：
//     自分のリムーブエリアにあるレベル5のカードを1枚までと、レベル4のカードを1枚までと、
//     レベル1のカードを1枚まで選び、好きな順番でデッキの下に移す。カードを合わせて3枚移した場合、
//     相手の現場にいるキャラを1枚まで選び、デッキの下に移す。
//     この能力は自分の現場にレベル7のキャラが3枚以上いる場合に宣言できる。
//
// 公式 qAndA (ct-p08 character.tsv):
//   - レベル+2 は現場でのみ (現場以外ではレベル5) — continuous scope:'on-scene' の既定。
//   - コストでリムーブした9枚も選択対象 (removeAreaToDeckTop は現在の remove state を読む)。
//   - コストは自分のデッキのみ / デッキ8枚以下では宣言不可 (canPay removeDeckTop gate)。
//
// 句マッピング (S2 B08057 — grounding 2026-07-10):
//   a1: 【解決編】このキャラをレベル+2 = PR264 a1 VERBATIM (caseStatus gate + lvlDelta:2)。
//   a2: 宣言条件「解決編」+「現場にレベル7のキャラ3枚以上」= and[caseStatus, sceneHas{levelMin:7,
//       levelMax:7 (EXACT — PR264「レベル7のキャラ」precedent。a1 の +2 で自身 5+2=7 も数える), nMin:3}]。
//       コスト =【スリープ】+ removeDeckTop n:9。
//       「レベル5を1枚までと、レベル4を1枚までと、レベル1を1枚まで」= removeAreaToDeckTop{dest:'bottom',
//       max:1, filter EXACT level} ×3 連続 (各移動が次 pick の候補から自然除外。各「まで」= 0枚可 rules/15)。
//       bindKey:'$moved' に移動成功分を accumulate (S2 primitive)。
//       「好きな順番でデッキの下」= deckBottomReorderBound (human 並べ替え / AI 移動順)。
//       「合わせて3枚移した場合」= conditional{if: boundCountCompare{'$moved', eq, 3}} →
//       「相手の現場のキャラを1枚まで選び、デッキの下」= sceneToDeck{side:'opp', max:1, pos:'bottom'}
//       (B01044 同型)。
//   ⚠ コスト9枚でデッキ0になった場合の即時リフレッシュは既知の engine gap (BUG-180 同類、cost 側
//     removeDeckTop も post-pay deck0 refresh を持たない)。BUG-180 水平展開に追記済。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'continuous',
  scope: 'on-scene',
  condition: { kind: 'caseStatus', status: '解決編' },
  continuousModifier: { lvlDelta: 2 },
  description: '【解決編】現場にいるこのキャラをレベル＋2する。',
  ruleRefs: ['rules/17-icons.md', 'rules/19-special-rules.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'declared',
  scope: 'on-scene',
  condition: {
    kind: 'and',
    cs: [
      { kind: 'caseStatus', status: '解決編' }, // 【解決編】
      // この能力は自分の現場にレベル7のキャラが3枚以上いる場合に宣言できる (a1 適用後の実効レベル)
      { kind: 'sceneHas', query: { area: 'scene', side: 'self', filter: { levelMin: 7, levelMax: 7 } }, nMin: 3 },
    ],
  },
  limit: { kind: 'turn', n: 1 },
  cost: { kind: 'pay', items: [{ kind: 'sleepSelf' }, { kind: 'removeDeckTop', player: 'self', n: 9 }] },
  effect: {
    kind: 'sequence',
    steps: [
      // レベル5 / 4 / 1 のカードを各1枚まで選び (逐次 pick — 前 pick の移動分は候補から自然除外)
      { kind: 'atom', verb: 'removeAreaToDeckTop', args: { player: 'self', dest: 'bottom', max: 1, bindKey: '$moved', filter: { levelMin: 5, levelMax: 5 } } },
      { kind: 'atom', verb: 'removeAreaToDeckTop', args: { player: 'self', dest: 'bottom', max: 1, bindKey: '$moved', filter: { levelMin: 4, levelMax: 4 } } },
      { kind: 'atom', verb: 'removeAreaToDeckTop', args: { player: 'self', dest: 'bottom', max: 1, bindKey: '$moved', filter: { levelMin: 1, levelMax: 1 } } },
      // 好きな順番でデッキの下に移す (human = 並べ替え modal / AI = 移動順)
      { kind: 'atom', verb: 'deckBottomReorderBound', args: { player: 'self', bindKey: '$moved' } },
      // カードを合わせて3枚移した場合、相手の現場のキャラを1枚まで選びデッキの下へ
      {
        kind: 'conditional',
        if: { kind: 'boundCountCompare', bindKey: '$moved', cmp: 'eq', n: 3 },
        then: { kind: 'atom', verb: 'sceneToDeck', args: { player: 'self', side: 'opp', max: 1, pos: 'bottom' } },
      },
    ],
  },
  description: '【解決編】【宣言】【ターン1】【スリープ】〚デッキ上から9枚リムーブ〛：リムーブのレベル5/4/1 を各1枚まで選び好きな順でデッキ下へ。合わせて3枚移した場合、相手の現場のキャラを1枚まで選びデッキ下へ。現場にレベル7が3枚以上いる場合に宣言可。',
  ruleRefs: ['rules/14-refresh.md', 'rules/15-abilities-effects.md', 'rules/21-declared-ability-cost.md', 'rules/26-qa-deck-refresh.md'],
};

export const B08057: CardDef = {
  id: 'B08057',
  no: '0895/B08057',
  kind: 'character',
  names: ['宮野エレーナ'],
  colors: ['赤'],
  level: 5,
  ap: 4000,
  lp: 1,
  traits: ['科学者', '医師'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1770731238663227.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/19-special-rules.md',
    'rules/21-declared-ability-cost.md',
    'rules/26-qa-deck-refresh.md',
  ],
};
