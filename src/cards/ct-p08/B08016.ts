// cards/ct-p08/B08016 脇田兼則 (character C) — engine拡張 wave#2 cluster1 (ability-presence filter)
// rules: rules/03-field-areas.md, rules/05-turn-phases.md, rules/14-refresh.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/20-color-and-switch.md, rules/26-qa-deck-refresh.md
// 公式テキスト:
//   【事件青＆黒】【事件編】【登場時】自分のデッキのカードを上から3枚見る。その中から【青】か【黒】のキャラを1枚まで公開して手札に加え、
//   残りを好きな順番でデッキの下に移す。カードを手札に加えた場合、手札を1枚リムーブする。
//   【相手ターン中】【現場リムーブ時】手札から【現場リムーブ時】を持つキャラを1枚リムーブしてもよい。そうした場合、カードを2枚引く。
// 句マッピング:
//   - a1 【事件青＆黒】 => condition caseColor{color:['青','黒'],combine:'and'} (要・両色)
//     [exact shape src/cards/ct-p08/B08088.ts a1 + src/cards/ct-d06/D06010.ts a1; combine:'and' ⇒ must have ALL (src/engine/cond/eval.ts:53)]
//   - a1 【事件編】 => condition caseStatus{status:'事件編'} [caseStatus exact shape src/cards/ct-p08/B08088.ts a1 (status:'解決編') / src/engine/cond/eval.ts:74; 事件編 = case 初期状態]
//   - a1 (2条件AND結合) => condition and{cs:[caseColor, caseStatus]} [and{cs:[...]} grounded src/cards/ct-p08/B08088.ts a1 (3条件), .every]
//   - a1 【登場時】 => trigger {hook:'enter', selfOnly:true}, scope:'on-scene' [exemplar B08020.ts a1]
//   - a1 自分のデッキのカードを上から3枚見る…【青】か【黒】のキャラを1枚まで公開して手札に加え、残りをデッキ下、加えた場合 discard1
//     = B08020.ts a1 完全同型 (deckRevealUntil chooseMatch:'upTo' + handAddFromDeck + discard + deckToBottomBound)。
//     色OR=配列 filter:{color:['青','黒'],kind:'character'} (hand pick に kind:'character' 必須 BUG-123)。
//     「1枚まで」=0枚可 (rules/15 + qAndA「条件を満たすカードがあった場合でも手札に加えないことはできますか? → はい、可能です」)
//     → chooseMatch:'upTo' (BUG-132 GAP-1 decline channel)。「加えた場合、手札を1枚リムーブ」= bound$matched presence で conditional gate (B08020 同型)。
//     デッキ3枚未満は残り全部見て解決、加えた時点で deck0 なら refresh (deckRevealUntil + handAddFromDeck の標準挙動、qAndA 整合)
//   - a2 【相手ターン中】 => condition turn{player:'opp'} [exemplar src/cards/ct-d05/D05007.ts a1 + src/cards/ct-p08/B08088.ts a1]
//   - a2 【現場リムーブ時】(このキャラ自身) => trigger {hook:'leave:to-remove', selfOnly:true}, scope:'on-scene'
//     [exemplar D05007.ts a1 / B08088.ts a1; リムーブ方法問わず self-leave で fire (handleLeaveToRemoveSelf)。
//      qAndA: 「カードを2枚引く」で refresh 発生時、このカード自身はシャッフル対象に含まれる (リムーブエリアに置かれた状態で解決) — engine 既定挙動と整合]
//   - a2 手札から【現場リムーブ時】を持つキャラを1枚リムーブしてもよい。そうした場合、カードを2枚引く。
//     => optional{chain[discard{player:'self',n:1,filter:{keyword:'現場リムーブ時',kind:'character'}}, draw{player:'self',n:2}]}
//     [「リムーブしてもよい」=optional、「そうした場合」=chain gate on leading discard。EXACT pattern src/cards/ct-p08/B08088.ts a1
//      (optional{chain[discard{n:1}, body]})。filter.keyword:'現場リムーブ時' は wave#2 cluster で追加、defHasKeyword/
//      abilityIsSceneRemoveTrigger が印字静的に判定 (src/engine/read/keyword.ts; candidates.ts:259 / atom-handlers.ts:97 双方経路で有効)。
//      hand pick に kind:'character' 必須 (BUG-123)。候補0なら __chainStepNoApply で chain break → draw 不発 (src/engine/effect/resolve-picks.ts)]

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  // 【事件青＆黒】【事件編】
  condition: {
    kind: 'and',
    cs: [
      { kind: 'caseColor', color: ['青', '黒'], combine: 'and' },
      { kind: 'caseStatus', status: '事件編' },
    ],
  },
  // 【登場時】
  trigger: { hook: 'enter', selfOnly: true },
  effect: {
    kind: 'sequence',
    steps: [
      {
        kind: 'atom',
        verb: 'deckRevealUntil',
        args: {
          chooseMatch: 'upTo',
          player: 'self',
          filter: { color: ['青', '黒'], kind: 'character' },
          maxN: 3,
          bind: '$revealed',
          bindMatch: '$matched',
        },
      },
      {
        kind: 'conditional',
        if: { kind: 'bound', key: '$matched', presence: 'matched' },
        then: {
          kind: 'sequence',
          steps: [
            { kind: 'atom', verb: 'handAddFromDeck', args: { player: 'self', cardId: '$matched.cardId', presentation: 'public-selected-card' } },
            { kind: 'atom', verb: 'discard', args: { player: 'self', n: 1 } },
          ],
        },
      },
      { kind: 'atom', verb: 'deckToBottomBound', args: { player: 'self', bindKey: '$revealed' } },
    ],
  },
  description:
    '【事件青＆黒】【事件編】【登場時】自分のデッキのカードを上から3枚見る。その中から【青】か【黒】のキャラを1枚まで公開して手札に加え、残りを好きな順番でデッキの下に移す。カードを手札に加えた場合、手札を1枚リムーブする。',
  ruleRefs: [
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/20-color-and-switch.md',
    'rules/26-qa-deck-refresh.md',
  ],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-scene',
  // 【相手ターン中】
  condition: { kind: 'turn', player: 'opp' },
  // 【現場リムーブ時】(このキャラ自身)
  trigger: { hook: 'leave:to-remove', selfOnly: true },
  // 手札から【現場リムーブ時】を持つキャラを1枚リムーブしてもよい。そうした場合、カードを2枚引く。
  effect: {
    kind: 'optional',
    effect: {
      kind: 'chain',
      steps: [
        { kind: 'atom', verb: 'discard', args: { player: 'self', n: 1, filter: { keyword: '現場リムーブ時', kind: 'character' } } },
        { kind: 'atom', verb: 'draw', args: { player: 'self', n: 2 } },
      ],
    },
  },
  description:
    '【相手ターン中】【現場リムーブ時】手札から【現場リムーブ時】を持つキャラを1枚リムーブしてもよい。そうした場合、カードを2枚引く。',
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/05-turn-phases.md',
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
  ],
};

export const B08016: CardDef = {
  id: 'B08016',
  no: '0857/B08016',
  kind: 'character',
  names: ['脇田兼則'],
  colors: ['青'],
  level: 4,
  ap: 4000,
  lp: 0,
  traits: ['寿司職人'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1770731204402610.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/05-turn-phases.md',
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/20-color-and-switch.md',
    'rules/26-qa-deck-refresh.md',
  ],
};
