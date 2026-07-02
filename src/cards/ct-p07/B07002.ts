// cards/ct-p07/B07002 江戸川コナン (キャラ) — wave-10 exemplar (boundDistinctColorCount +
// setCutinBan/setDisguiseBan + BUG-165 multi-pick fix の初 consumer)
// rules: 09-cutin-disguise.md, 15-abilities-effects.md, 17-icons.md, 19-special-rules.md(色),
//        20-color-and-switch.md, 21-declared-ability-cost.md, 25-qa-effects-resolution.md
//
// 公式テキスト:
//   【登場時】カードを2枚引き、手札を2枚リムーブする。この効果によってそれぞれ色の異なる
//     （同じ色を持たない）〚特徴［探偵］〛のキャラを2枚リムーブした場合、AP8000以下のキャラを
//     1枚まで選び、リムーブする。
//   【宣言】〚このキャラか、特徴［探偵］のキャラを1枚スリープさせる〛：このターン中、相手は
//     【カットイン】と【変装】を使用できない。
//   公式Q&A: (a1) デッキ残り2枚以下 → 引ききった時点で即リフレッシュ、残り1枚なら1枚引く。
//            そのあとで手札を2枚リムーブする (draw atom の標準 refresh 挙動と一致)。
//        (b) 【宣言】効果は使用後このキャラが現場を離れても有効 (ターン中) → side-level turn-flag。
//        (c) コスト「このキャラか、特徴[探偵]のキャラ」は相手現場は不可 (rules/21 コストは自分のカードのみ)。
//
// 句マッピング:
//   [effect col a1] 「カードを2枚引き」 => steps[0] draw {player:'self', n:2}。
//   「手札を2枚リムーブする」 => steps[1] discard {player:'self', n:2, bind:'$discarded'} (D09004 a2 step2 と
//     同型の discard+bind、n:2 = 固定2枚 (「まで」なし rules/15)。BUG-165 fix で human/AI 全経路 2枚解決)。
//   「この効果によってそれぞれ色の異なる（同じ色を持たない）〚特徴［探偵］〛のキャラを2枚リムーブした場合」
//     => steps[2] conditional.if = boundDistinctColorCount {bindKey:'$discarded',
//        filter:{kind:'character', trait:'探偵'}, n:2} (wave-10 新 cond)。「同じ色を持たない」= 色集合の
//        pairwise 交差空 (2色カードは rules/20 でどちらの色でも扱う → 1色でも共有すれば不成立)。
//        kind:'character' = 「のキャラ」(手札にはイベント混在、BUG-123 流儀)。
//   「AP8000以下のキャラを1枚まで選び、リムーブする」 => conditional.then = sceneRemove
//        {player:'self', max:1, side:'either', filter:{apMax:8000}} — D02002/D01004 a1 step2 と VERBATIM
//        (max:1=0枚可 rules/15「まで」、side:'either'=エリア無指定「キャラ」= 両現場+自身可 rules/15)。
//        conditional.then 内の PA 短縮形 pick は BUG-145 裁定で安全 (dispatch 時 surface)。
//   [effect col a2] 「【宣言】〚このキャラか、特徴［探偵］のキャラを1枚スリープさせる〛：」
//     => a2 declared (【ターン1】表記なし → limit 無し)。cost = sleepChar {pick query
//        {area:'scene', side:'self', filter:{trait:'探偵'}}, n:{min:1,max:1}} (B03060 と同型だが
//        excludeSelf 無し —「このキャラか、」で自身包含。B07002 自身が特徴[探偵] ゆえ filter で被覆。
//        side:'self' = 公式 Q&A (c) rules/21)。canPay = active 1枚以上 (スリープさせる、rules/03)。
//        ※既知の engine-wide 制約: target-pick cost は head-fixed (どの探偵を寝せるかの player-choice
//        は全 cost 共通の別 initiative、BUG-156 注記)。
//   「このターン中、相手は【カットイン】と【変装】を使用できない」 => effect = sequence[
//        setCutinBan {player:'opp'}, setDisguiseBan {player:'opp'}] (wave-10 新 verb、turn-scoped
//        side-level flag → canCutIn/canDisguise gate、Q&A (b) 離場後有効、resetTurnFlags 清掃)。
//   [cutIn col] 空 / [hirameki col] 空 / [henso col] 空 → 未カバー句なし。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'enter', selfOnly: true },
  effect: {
    kind: 'sequence',
    steps: [
      { kind: 'atom', verb: 'draw', args: { player: 'self', n: 2 } },
      { kind: 'atom', verb: 'discard', args: { player: 'self', n: 2, bind: '$discarded' } },
      {
        kind: 'conditional',
        if: { kind: 'boundDistinctColorCount', bindKey: '$discarded', filter: { kind: 'character', trait: '探偵' }, n: 2 },
        then: { kind: 'atom', verb: 'sceneRemove', args: { player: 'self', max: 1, side: 'either', filter: { apMax: 8000 } } },
      },
    ],
  },
  description: '【登場時】カードを2枚引き、手札を2枚リムーブする。この効果によってそれぞれ色の異なる（同じ色を持たない）〚特徴［探偵］〛のキャラを2枚リムーブした場合、AP8000以下のキャラを1枚まで選び、リムーブする。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/20-color-and-switch.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'declared',
  scope: 'on-scene',
  cost: {
    kind: 'pay',
    items: [
      { kind: 'sleepChar', target: { kind: 'pick', query: { area: 'scene', side: 'self', filter: { trait: '探偵' } }, n: { min: 1, max: 1 }, chooser: 'self' } },
    ],
  },
  effect: {
    kind: 'sequence',
    steps: [
      { kind: 'atom', verb: 'setCutinBan', args: { player: 'opp' } },
      { kind: 'atom', verb: 'setDisguiseBan', args: { player: 'opp' } },
    ],
  },
  description: '【宣言】〚このキャラか、特徴［探偵］のキャラを1枚スリープさせる〛：このターン中、相手は【カットイン】と【変装】を使用できない。',
  ruleRefs: ['rules/09-cutin-disguise.md', 'rules/15-abilities-effects.md', 'rules/21-declared-ability-cost.md', 'rules/25-qa-effects-resolution.md'],
};

export const B07002: CardDef = {
  id: 'B07002',
  no: '0734/B07002',
  kind: 'character',
  names: ['江戸川コナン'],
  colors: ['青'],
  level: 8,
  ap: 7000,
  lp: 2,
  traits: ['探偵', '毛利探偵事務所', '少年探偵団'],
  keywords: [],
  rarity: 'SR',
  imageUrl: '199276e4e6f1ec.jpg',
  abilities: [a1, a2],
  ruleRefs: ['rules/09-cutin-disguise.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/20-color-and-switch.md', 'rules/21-declared-ability-cost.md'],
};
