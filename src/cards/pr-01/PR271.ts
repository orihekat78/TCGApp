// cards/pr-01/PR265 風見裕也 (キャラ) — M2後半 batch (2026-07-10, mill n:{dyn} first-consumer)
// rules: 14-refresh.md, 15-abilities-effects.md, 17-icons.md, 21-declared-ability-cost.md, 26-qa-deck-refresh.md
// grounding: .claude/specs/grounding/PR265.md
//
// 公式テキスト:
//   【登場時】自分のデッキのカードを上から1枚見る。その中から〚特徴［警視庁］〛のキャラを1枚まで公開して
//   手札に加え、残りを好きな順番でデッキの下に移す。カードを手札に加えた場合、自分のデッキのカードを
//   上からそのカードのレベルと同じ枚数リムーブする。
//   【解決編】【宣言】【スリープ】〚手札を1枚リムーブする〛：レベル5以下のキャラを1枚まで選び、リムーブする。
//
// 句マッピング:
//   a1 (triggered enter selfOnly — D01013 a1 の maxN:1 clone + mill 差替):
//     - 「上から1枚見る…1枚まで公開して手札に加え」=> deckRevealUntil{maxN:1, chooseMatch:'upTo'}
//       (「まで」= 加えない選択可、B08020 公式Q&A / rules/26)。
//     - 「残りを好きな順番でデッキの下」=> deckToBottomBound $revealed (maxN:1 なら残り高々1枚)。
//     - 「加えた場合…そのカードのレベルと同じ枚数リムーブ」=> conditional bound $matched →
//       handAddFromDeck $matched.cardId → mill{n:{dyn:'$bound.$matched.level'}}
//       (handler-local dyn 解決 — M2後半 core.ts atomMill。walk-literalize 罠のため pre-walk 不可)。
//       mill のデッキ不足 = 可能な限りリムーブ → refresh → 残り分はリムーブしない (公式Q&A / rules/14)。
//   a2 (declared, scope 'on-scene' — B07079 a2 cost 同型):
//     - 【解決編】=> condition caseStatus:'解決編'。
//     - 【スリープ】〚手札を1枚リムーブする〛=> cost pay[sleepSelf, removeFromHand n:1]。
//     - 「レベル5以下のキャラを1枚まで選び、リムーブする」=> sceneRemove 短縮形
//       (側指定なし = どちらの現場でも rules/15、「1枚まで」= 0枚可)。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'enter', selfOnly: true },
  effect: {
    kind: 'sequence',
    steps: [
      // デッキ上から1枚見る — [警視庁] キャラ該当なら $matched に bind (取得は任意 = upTo)
      {
        kind: 'atom',
        verb: 'deckRevealUntil',
        args: {
          chooseMatch: 'upTo',
          player: 'self',
          filter: { trait: '警視庁', kind: 'character' },
          maxN: 1,
          bind: '$revealed',
          bindMatch: '$matched',
        },
      },
      // 加えた場合: 手札に加え、そのカードの印字レベルと同じ枚数を上からリムーブ
      {
        kind: 'conditional',
        if: { kind: 'bound', key: '$matched', presence: 'matched' },
        then: {
          kind: 'sequence',
          steps: [
            { kind: 'atom', verb: 'handAddFromDeck', args: { player: 'self', cardId: '$matched.cardId' } },
            { kind: 'atom', verb: 'mill', args: { player: 'self', n: { dyn: '$bound.$matched.level' } } },
          ],
        },
      },
      // 残りを好きな順番でデッキの下に移す
      { kind: 'atom', verb: 'deckToBottomBound', args: { player: 'self', bindKey: '$revealed' } },
    ],
  },
  description:
    '【登場時】自分のデッキのカードを上から1枚見る。その中から〚特徴［警視庁］〛のキャラを1枚まで公開して手札に加え、残りを好きな順番でデッキの下に移す。カードを手札に加えた場合、自分のデッキのカードを上からそのカードのレベルと同じ枚数リムーブする。',
  ruleRefs: [
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/26-qa-deck-refresh.md',
  ],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'declared',
  scope: 'on-scene',
  condition: { kind: 'caseStatus', status: '解決編' },
  // 【スリープ】〚手札を1枚リムーブする〛 (コスト: 全部実行 rules/21)
  cost: {
    kind: 'pay',
    items: [
      { kind: 'sleepSelf' },
      { kind: 'removeFromHand', target: { kind: 'pick', query: { area: 'hand', side: 'self' }, n: { min: 1, max: 1 }, chooser: 'self' }, n: 1 },
    ],
  },
  // レベル5以下のキャラを1枚まで選び、リムーブする (側指定なし = どちらの現場でも rules/15)
  effect: { kind: 'atom', verb: 'sceneRemove', args: { player: 'self', max: 1, side: 'either', filter: { levelMax: 5, kind: 'character' }, cause: 'effect' } },
  description:
    '【解決編】【宣言】【スリープ】〚手札を1枚リムーブする〛：レベル5以下のキャラを1枚まで選び、リムーブする。',
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md',
  ],
};

export const PR271: CardDef = {
  id: 'PR271',
  no: '1056/PR271',
  kind: 'character',
  names: ['風見裕也'],
  colors: ['黄'],
  level: 5,
  ap: 5000,
  lp: 1,
  traits: ['警察', '警視庁', '公安'],
  keywords: [],
  rarity: 'PR',
  imageUrl: '1774884005702702.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md',
    'rules/26-qa-deck-refresh.md',
  ],
};
