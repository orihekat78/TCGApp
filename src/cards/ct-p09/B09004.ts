// cards/ct-p09/B09004 毛利蘭 (character) — engine mega-wave W3 exemplar (r18, 2026-07-03)
// rules: 13-keywords.md, 15-abilities-effects.md, 17-icons.md, 19-special-rules.md,
//        21-declared-ability-cost.md, 25-qa-effects-resolution.md
//
// 公式テキスト:
//   〚突撃〛（名乗り状態でもアクションできる）
//   【絆工藤新一】【自分ターン中】【ターン1】自分の能力や効果、【宣言】能力のコストによって手札から
//   〚カード名［工藤新一］〛か〚［毛利蘭］〛を公開したとき、手札を1枚リムーブしてもよい。
//   （現在の効果を解決してからリムーブする）そうした場合、レベル7以下のキャラを1枚まで選び、リムーブする。
//
// 句マッピング:
//   〚突撃〛=> keywords:['突撃'] (rules/13)。
//   【絆工藤新一】【自分ターン中】=> condition and[bond{cardName:'工藤新一'}, turn{player:'self'}]。
//     公式Q&A「発動後に絆が有効でなくなっても解決できる」= rules/25 発動済み効果は無効化されない (既存挙動)。
//   【ターン1】=> limit{kind:'turn', n:1} (fire-time カウント、rules/24)。
//   「自分の能力や効果、【宣言】能力のコストによって手札から〚カード名［工藤新一］〛か〚［毛利蘭］〛を
//     公開したとき」=> trigger{hook:'hand:reveal', matcherCondition:{kind:'triggerRevealMatches',
//     side:'self', cardName:['工藤新一','毛利蘭']}} (W3 新 primitive)。
//     emit = mutate.hand.emitReveal 単一ソース (atomHandReveal 効果経路 + revealFromHand コスト経路の両方、
//     印字が「コストによって」を明示するためコスト由来も無条件対象)。「か」= cardName 配列 any-match
//     (rules/19 分割名対応)。selfOnly 不使用 — 観測対象は自分側の手札公開全般 (cutin:used 型第三者観測)。
//     公式Q&A「デッキのカードを公開して手札に加えるときは発動しない」= deck reveal は別経路 (emit なし)。
//   「手札を1枚リムーブしてもよい。（現在の効果を解決してからリムーブする）そうした場合、レベル7以下の
//     キャラを1枚まで選び、リムーブする」=> optional{chain[discard{max:1}, sceneRemove{max:1, side:'either',
//     filter:{levelMax:7, kind:'character'}}]}。括弧書き「現在の効果を解決してから」= 未解決効果の
//     queue 後解決 (rules/25、trigger 反応は現在の効果完了後に解決される既存機序) の確認的注記。
//     「そうした場合」= chain。discard は n:1 (optional opt-in 後は必ず1枚 — D04007/D09010/B02068 の
//     「〜してもよい。そうした場合」idiom、二重辞退面を作らない。混成 review nit 反映)。
import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  limit: { kind: 'turn', n: 1 },
  trigger: {
    hook: 'hand:reveal',
    matcherCondition: { kind: 'triggerRevealMatches', side: 'self', cardName: ['工藤新一', '毛利蘭'] },
  },
  condition: {
    kind: 'and',
    cs: [
      { kind: 'bond', cardName: '工藤新一' },
      { kind: 'turn', player: 'self' },
    ],
  },
  effect: {
    kind: 'optional',
    effect: {
      kind: 'chain',
      steps: [
        { kind: 'atom', verb: 'discard', args: { player: 'self', n: 1 } },
        { kind: 'atom', verb: 'sceneRemove', args: { player: 'self', max: 1, side: 'either', filter: { levelMax: 7, kind: 'character' } } },
      ],
    },
  },
  description:
    '【絆工藤新一】【自分ターン中】【ターン1】自分の能力や効果、【宣言】能力のコストによって手札から〚カード名［工藤新一］〛か〚［毛利蘭］〛を公開したとき、手札を1枚リムーブしてもよい。（現在の効果を解決してからリムーブする）そうした場合、レベル7以下のキャラを1枚まで選び、リムーブする。',
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/19-special-rules.md',
    'rules/21-declared-ability-cost.md',
    'rules/25-qa-effects-resolution.md',
  ],
};

export const B09004: CardDef = {
  id: 'B09004',
  no: '0949/B09004',
  kind: 'character',
  names: ['毛利蘭'],
  colors: ['青'],
  level: 7,
  ap: 6000,
  lp: 0,
  traits: ['高校生', '毛利探偵事務所', '空手家'],
  keywords: ['突撃'],
  rarity: 'SR',
  imageUrl: '1775608802582450.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/19-special-rules.md',
    'rules/21-declared-ability-cost.md',
    'rules/25-qa-effects-resolution.md',
  ],
};
