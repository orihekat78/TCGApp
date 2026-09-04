// cards/ct-d10/D10005 ハート姫（毛利蘭） (character) — CARD PHASE step12 (useEventFromHand consumer、engine変更0)
// rules: rules/15-abilities-effects.md, rules/17-icons.md, rules/19-special-rules.md,
//        rules/21-declared-ability-cost.md
//
// 公式テキスト:
//   【事件シャッフルロマンス】【登場時】このキャラをスリープさせ、手札を1枚リムーブしてもよい。
//   そうした場合、自分のリムーブエリアにあるレベル8以下の〚カード名［黒衣の騎士・スペイド］〛を
//   1枚まで選び、登場させる。
//   【絆工藤新一】【宣言】【ターン1】手札から〚カード名［シャッフルロマンス］〛のイベントを1枚まで使用する。
//
// 句マッピング:
//   - 【事件シャッフルロマンス】=> 共通クラス caseTraitConditioned (D10003/D10004 同型、
//     自分の事件が特徴[シャッフルロマンス]を持つ場合に有効)。
//   - 「このキャラをスリープさせ、手札を1枚リムーブしてもよい。そうした場合〜」=>
//     optional{chain[sceneSetState self sleep, discard 1, sceneEnter from:remove]} (PR144 structural twin)。
//     公式Q&A「スリープ状態で登場した場合は行えない」= mandatory trigger後、effect-time
//     charStateIs(self,active) conditionalがoptional全体を抑止 (BUG-145、PR138/PR144/B04049同型)。
//   - 「リムーブエリアにあるレベル8以下の〚カード名［黒衣の騎士・スペイド］〛を1枚まで選び、登場」=>
//     sceneEnter{from:'remove', max:1, filter:{cardName:'黒衣の騎士・スペイド', levelMax:8,
//     kind:'character'}} (cardName filter は分割名 any-match rules/19 — 手札からリムーブした
//     カードも選べる Q&A = chain 逐次解決で自動整合)。
//   - 【絆工藤新一】【宣言】【ターン1】=> declared + bond{工藤新一} + limit turn:1 (B02004/B01087 idiom)。
//   - 「手札から〚カード名［シャッフルロマンス］〛のイベントを1枚まで使用する」=>
//     useEventFromHand{max:1, filter:{cardName:'シャッフルロマンス', kind:'event'}}
//     (engine mega-wave W6 step3 — FILE/色制限バイパス)。
import type { AbilityDef, CardDef } from '@/engine/types';
import { caseTraitConditioned } from '../_shared/index.js';

const a1: AbilityDef = caseTraitConditioned({
  trait: 'シャッフルロマンス',
  inner: {
    id: 'a1',
    type: 'triggered',
    scope: 'on-scene',
    trigger: { hook: 'enter', selfOnly: true },
    effect: {
      kind: 'conditional',
      if: { kind: 'charStateIs', ref: { kind: 'self' }, state: 'active' },
      then: {
        kind: 'optional',
        effect: {
          kind: 'chain',
          steps: [
          { kind: 'atom', verb: 'sceneSetState', args: { uid: '$self', state: 'sleep' } },
          { kind: 'atom', verb: 'discard', args: { player: 'self', n: 1 } },
          {
            kind: 'atom',
            verb: 'sceneEnter',
            args: {
              player: 'self',
              from: 'remove',
              max: 1,
              viaEffect: true,
              filter: { cardName: '黒衣の騎士・スペイド', levelMax: 8, kind: 'character' },
            },
          },
          ],
        },
      },
    },
    description:
      '【事件シャッフルロマンス】【登場時】このキャラをスリープさせ、手札を1枚リムーブしてもよい。そうした場合、自分のリムーブエリアにあるレベル8以下の〚カード名［黒衣の騎士・スペイド］〛を1枚まで選び、登場させる。',
    ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/19-special-rules.md'],
  },
});

const a2: AbilityDef = {
  id: 'a2',
  type: 'declared',
  scope: 'on-scene',
  condition: { kind: 'bond', cardName: '工藤新一' },
  limit: { kind: 'turn', n: 1 },
  effect: {
    kind: 'atom',
    verb: 'useEventFromHand',
    args: { player: 'self', max: 1, filter: { cardName: 'シャッフルロマンス', kind: 'event' } },
  },
  description: '【絆工藤新一】【宣言】【ターン1】手札から〚カード名［シャッフルロマンス］〛のイベントを1枚まで使用する。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/21-declared-ability-cost.md'],
};

export const D10005: CardDef = {
  id: 'D10005',
  no: '0839/D10005',
  kind: 'character',
  names: ['ハート姫（毛利蘭）', 'ハート姫', '毛利蘭'],
  colors: ['青'],
  level: 8,
  ap: 6000,
  lp: 1,
  traits: ['高校生', '毛利探偵事務所', '空手家'],
  rarity: 'D',
  imageUrl: '1761913165195649.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/19-special-rules.md',
    'rules/21-declared-ability-cost.md',
  ],
};
