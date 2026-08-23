// cards/ct-p09/B09112 キッドVS安室 王妃の前髪 (case) — engine additive WB2 (2026-07-11)
// rules: 01-victory-conditions.md, 12-next-hint.md, 14-refresh.md, 15-abilities-effects.md,
//        17-icons.md, 19-special-rules.md, 21-declared-ability-cost.md, 26-qa-deck-refresh.md
//
// 公式テキスト:
//   この事件が解決編になったとき、自分は手札を1枚リムーブする。
//   【解決編】【宣言】【ターン1】〚裏向きの証拠を2つ表向きにする〛：カード名を1つ指定し、自分の現場にいる
//   指定したカード名のキャラ1枚につき、自分のデッキのカードを上から1枚見る。その中から指定したカード名の
//   キャラを1枚まで公開して手札に加え、残りを好きな順番でデッキの下に移す。
//
// 句マッピング:
//   - a1「この事件が解決編になったとき、自分は手札を1枚リムーブする」=> triggered case:to-resolved selfOnly
//     → discard{n:1, player:'self'} (B09111 a1 同型)。
//   - a2「【解決編】【宣言】【ターン1】〚裏向きの証拠を2つ表向きにする〛」=> declared, condition caseStatus 解決編,
//     limit turn1, cost flipFaceUpEvidence{n:{min:2,max:2}} (B09111 a2 同型。「2つ表向きにできない場合は使用不可」
//     = canPay 床)。
//   - a2「カード名を1つ指定し」=> declareName{bind:'named'} (W6 step1 verb、UI=DeclareCardNameModal→
//     AbilityCostParams.declaredName、AI=未供給→空文字→後段 maxN=0/filter 不一致)。
//   - a2「自分の現場にいる指定したカード名のキャラ1枚につき、自分のデッキのカードを上から1枚見る」=>
//     deckRevealUntil{player:'self', maxN:{dyn:'$declared.named.sceneNameCount'}, ...} (WB2 engine: maxN {dyn}
//     dispatch-time 解決 + pre-walk $declared deferral。sceneNameCount = ctx.source.player の現場で宣言名を
//     名前に持つキャラ数、rules/19 分割名 any-match)。デッキ不足は残り全部を見て解決 (公式Q&A、refresh は
//     加えた時点で判定、handAddFromDeck が内蔵)。
//   - a2「その中から指定したカード名のキャラを1枚まで公開して手札に加え」=> chooseMatch:'upTo' +
//     filter:{cardName:{dyn:'$declared.named'}, kind:'character'} → $matched → handAddFromDeck (D01013 同型)。
//     「1枚まで」= 0枚可 (公式Q&A「条件を満たすカードがあっても手札に加えないことは可能」)。
//   - a2「残りを好きな順番でデッキの下に移す」=> deckToBottomBound{bindKey:'$revealed'} (D01013 同型。
//     「好きな順」= human 任意/AI given)。

import type { AbilityDef, CardDef } from '@/engine/types';

// 解決編移行時: 自分の手札を1枚リムーブ (B09111 a1 同型)
const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'always',
  trigger: { hook: 'case:to-resolved', selfOnly: true },
  effect: { kind: 'atom', verb: 'discard', args: { n: 1, player: 'self' } },
  description: 'この事件が解決編になったとき、自分は手札を1枚リムーブする。',
  ruleRefs: ['rules/01-victory-conditions.md', 'rules/15-abilities-effects.md'],
};

// 【解決編】【宣言】【ターン1】〚裏向きの証拠を2つ表向きにする〛：指定名キャラ1枚につきデッキ上から1枚見て、
//   その中から指定名キャラを1枚まで手札に加え、残りをデッキ下へ。
const a2: AbilityDef = {
  id: 'a2',
  type: 'declared',
  scope: 'always',
  condition: { kind: 'caseStatus', status: '解決編' },
  limit: { kind: 'turn', n: 1 },
  cost: { kind: 'flipFaceUpEvidence', n: { min: 2, max: 2 } },
  effect: {
    kind: 'sequence',
    steps: [
      // カード名を1つ指定 (供給 = declaredName costParam / AI 未供給 → 空文字)
      { kind: 'atom', verb: 'declareName', args: { bind: 'named' } },
      // 指定名キャラ1枚につきデッキ上から1枚見る (maxN = 現場の指定名キャラ数、{dyn} dispatch 解決)。
      //   その中の指定名キャラ 1 枚を $matched、残りを $revealed に bind。
      {
        kind: 'atom',
        verb: 'deckRevealUntil',
        args: {
          chooseMatch: 'upTo',
          player: 'self',
          maxN: { dyn: '$declared.named.sceneNameCount' },
          filter: { cardName: { dyn: '$declared.named' }, kind: 'character' },
          bind: '$revealed',
          bindMatch: '$matched',
        },
      },
      // 該当があれば手札に加える (「1枚まで」= 0枚可 → matched 空なら then 不発)
      {
        kind: 'conditional',
        if: { kind: 'bound', key: '$matched', presence: 'matched' },
        then: {
          kind: 'atom',
          verb: 'handAddFromDeck',
          args: {
            player: 'self',
            cardId: '$matched.cardId',
            presentation: 'public-selected-card',
          },
        },
      },
      // 残りを好きな順番でデッキの下へ
      { kind: 'atom', verb: 'deckToBottomBound', args: { player: 'self', bindKey: '$revealed' } },
    ],
  },
  description:
    '【解決編】【宣言】【ターン1】〚裏向きの証拠を2つ表向きにする〛：カード名を1つ指定し、自分の現場にいる指定したカード名のキャラ1枚につき、自分のデッキのカードを上から1枚見る。その中から指定したカード名のキャラを1枚まで公開して手札に加え、残りを好きな順番でデッキの下に移す。',
  ruleRefs: [
    'rules/01-victory-conditions.md',
    'rules/12-next-hint.md',
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/19-special-rules.md',
    'rules/21-declared-ability-cost.md',
    'rules/26-qa-deck-refresh.md',
  ],
};

export const B09112: CardDef = {
  id: 'B09112',
  no: '1051/B09112',
  kind: 'case',
  names: ['キッドVS安室 王妃の前髪'],
  colors: ['白', '黄'],
  caseTraits: [],
  traits: [],
  rarity: 'C',
  imageUrl: '1775608962378918.jpg',
  abilities: [a1, a2],
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/21-declared-ability-cost.md'],
};
