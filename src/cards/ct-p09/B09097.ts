// cards/ct-p09/B09097 コルン (character) — Task A green候補 再author (engine変更0)
// rules: rules/14-refresh.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/26-qa-deck-refresh.md
// 公式テキスト:
//   【事件赤＆黒】【事件編】【登場時】手札から【赤】か【黒】のカードを1枚リムーブしてもよい。そうした場合、カードを2枚引く。この効果によってレベル7以上のカードをリムーブした場合、相手のデッキのカードを上から3枚リムーブする。
// 公式Q&A: ①「2枚引く」でリフレッシュ等が起き手札からリムーブしたL7+がリムーブエリアに無くても条件は満たす (=リムーブ時点の identity で判定、リムーブエリア確認ではない)。
//          ②相手デッキ残り2枚以下 → 可能な限りリムーブ後リフレッシュ、残りは追加リムーブしない (rules/26)。
// 句マッピング:
//   - 【事件赤＆黒】【事件編】 => ability.condition and[ caseColor{color:['赤','黒'], combine:'and'}, caseStatus{status:'事件編'} ]
//     [caseColor combine:'and' = 事件が赤と黒の両方を持つ (rules/17 【事件(色1)&(色2)】、src/cards/ct-p09/B09092.ts VERBATIM)。
//      caseStatus '事件編' = src/cards/ct-p04/B04056.ts a1 VERBATIM。両 icon を and で結合 (どちらも成立必須)。]
//   - 【登場時】 => triggered, trigger {hook:'enter', selfOnly:true}, scope 'on-scene' [src/cards/ct-p04/B04049.ts a1 等 VERBATIM。
//      BUG-146 で enter source は登場キャラに統一済 = selfOnly が登場した本人に一致。]
//   - 手札から【赤】か【黒】のカードを1枚リムーブしてもよい => chain step1 discard {player:'self', max:1, filter:{color:['赤','黒']}, bind:'$removed'}
//     [src/cards/ct-p04/B04056.ts a1 / ct-d08/D08003.ts a1: 'リムーブしてもよい。そうした場合' = bare chain + discard max:1 (min:0=decline可、
//      rules/15)。color:['赤','黒'] = membership-OR (赤 か 黒、src/cards/ct-p09/B09088.ts color 配列同型)。kind filter 無 = 'カード' (キャラ/イベント両方)。
//      bind:'$removed' = リムーブしたカードを束縛 (atom-handlers discard L356: target.length>0 のとき ctx.bindings['$removed']=[{cardId}]、BUG-114)。]
//   - そうした場合、カードを2枚引く => chain step2 draw {player:'self', n:2} [step1 が 0-pick decline/no-candidate なら chain break → draw skip
//     (= 'そうした場合' gate、B04056 同型)。step1 で実リムーブ時のみ draw。]
//   - この効果によってレベル7以上のカードをリムーブした場合、相手のデッキのカードを上から3枚リムーブする => chain step3
//     conditional{ if: boundMatchesFilter{bindKey:'$removed', filter:{levelMin:7}}, then: atom mill{player:'opp', n:3} }
//     [boundMatchesFilter = src/cards/ct-p09/B09038.ts a2 / B07058.ts a1 同型 ($removed[0].cardId を TargetFilter で評価、束縛時点の identity =
//      Q&A①「リムーブエリアに無くても条件満たす」を充足。levelMin:7 は matchOneFilter の印字レベル下限、src/cards/ct-p07/B07070.ts filter:{levelMin:7} 同型)。
//      mill = '相手のデッキのカードを上からN枚リムーブ' (src/cards/ct-p09/B09092.ts a1 VERBATIM、player:'opp')。atom-handlers mill: デッキ枯渇で
//      refresh + deck-out 勝敗 (BUG-137、Q&A② + rules/14/26 を充足)。discard 0-pick 時は $removed 未束縛 → boundMatchesFilter false → mill 不発。]

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  // 【事件赤＆黒】【事件編】
  condition: {
    kind: 'and',
    cs: [
      { kind: 'caseColor', color: ['赤', '黒'], combine: 'and' },
      { kind: 'caseStatus', status: '事件編' },
    ],
  },
  // 【登場時】
  trigger: { hook: 'enter', selfOnly: true },
  effect: {
    kind: 'chain',
    steps: [
      // 手札から【赤】か【黒】のカードを1枚リムーブしてもよい (bind:$removed)
      { kind: 'atom', verb: 'discard', args: { player: 'self', max: 1, filter: { color: ['赤', '黒'] }, bind: '$removed' } },
      // そうした場合、カードを2枚引く
      { kind: 'atom', verb: 'draw', args: { player: 'self', n: 2 } },
      // この効果によってレベル7以上のカードをリムーブした場合、相手のデッキのカードを上から3枚リムーブする
      {
        kind: 'conditional',
        if: { kind: 'boundMatchesFilter', bindKey: '$removed', filter: { levelMin: 7 } },
        then: { kind: 'atom', verb: 'mill', args: { player: 'opp', n: 3 } },
      },
    ],
  },
  description: '【事件赤＆黒】【事件編】【登場時】手札から【赤】か【黒】のカードを1枚リムーブしてもよい。そうした場合、カードを2枚引く。この効果によってレベル7以上のカードをリムーブした場合、相手のデッキのカードを上から3枚リムーブする。',
  ruleRefs: [
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/26-qa-deck-refresh.md',
  ],
};

export const B09097: CardDef = {
  id: 'B09097',
  no: '1036/B09097',
  kind: 'character',
  names: ['コルン'],
  colors: ['黒'],
  level: 4,
  ap: 4000,
  lp: 0,
  traits: ['黒ずくめの組織'],
  rarity: 'C',
  imageUrl: '1775608943883624.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/26-qa-deck-refresh.md',
  ],
};
