// cards/ct-p06/B06019 クモ男 (character) — engine拡張 wave (evidence-flip-facedown 有効化, 2026-06-23)
// rules: rules/03-field-areas.md, rules/10-action-event.md, rules/14-refresh.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/20-color-and-switch.md
//
// 公式テキスト:
//   【事件編】【登場時】手札から【緑】の〚特徴［YAIBA］〛のカードを1枚リムーブしてもよい。そうした場合、カードを2枚引く。
//   【ヒラメキ】（証拠からリムーブされるときに発動する）自分の表向きの証拠を1つまで選び、裏向きにする。
//
// 句マッピング:
//   - 【事件編】【登場時】 => a1 trigger {hook:'enter', selfOnly:true} + condition caseStatus{status:'事件編'}
//     (条件は trigger 時に evalCond 評価、B04056.ts a1 等で caseStatus '事件編' 実証。eval.ts:75 case.status===cond.status)
//   - 手札から【緑】〚YAIBA〛のカードを1枚リムーブしてもよい。そうした場合、カードを2枚引く =>
//     a1.effect chain[ discard{player:'self', max:1, filter:{color:'緑', trait:'YAIBA'}}, draw{player:'self', n:2} ]
//     (D08003.ts a1 = 同パターン chain[discard{max:1,filter}, X]。max:1 = 0〜1「してもよい」(0枚=decline)、
//      chain no-apply-break = 「そうした場合」(discard 0枚なら draw skip)。filter は trait:'YAIBA' が event を
//      自動除外 (event は traits:[]) ゆえ kind 省略でも「カード」semantics 忠実 = D08003 と同流儀)。
//   - 【ヒラメキ】自分の表向きの証拠を1つまで選び、裏向きにする => a2 {type:'triggered', scope:'on-evidence',
//     trigger:{hook:'evidence:remove-by-action', optional:true}} + atom evidenceFlipDown 短縮形
//     {player:'self', max:1, faceUp:true} (engine拡張 wave 2026-06-23、B05013.ts a2 と同型)。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'enter', selfOnly: true }, // 【登場時】
  condition: { kind: 'caseStatus', status: '事件編' }, // 【事件編】
  // 手札から【緑】〚YAIBA〛のカードを1枚リムーブしてもよい。そうした場合、カードを2枚引く
  effect: {
    kind: 'chain',
    steps: [
      { kind: 'atom', verb: 'discard', args: { player: 'self', max: 1, filter: { color: '緑', trait: 'YAIBA' } } },
      { kind: 'atom', verb: 'draw', args: { player: 'self', n: 2 } },
    ],
  },
  description: '【事件編】【登場時】手札から【緑】の〚特徴［YAIBA］〛のカードを1枚リムーブしてもよい。そうした場合、カードを2枚引く。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/20-color-and-switch.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-evidence',
  trigger: { hook: 'evidence:remove-by-action', optional: true }, // 【ヒラメキ】(任意発動)
  // 自分の表向きの証拠を1つまで選び、裏向きにする
  effect: { kind: 'atom', verb: 'evidenceFlipDown', args: { player: 'self', max: 1, faceUp: true } },
  description: '【ヒラメキ】（証拠からリムーブされるときに発動する）自分の表向きの証拠を1つまで選び、裏向きにする。',
  ruleRefs: ['rules/10-action-event.md', 'rules/14-refresh.md'],
};

export const B06019: CardDef = {
  id: 'B06019',
  no: '0642/B06019',
  kind: 'character',
  names: ['クモ男'],
  colors: ['緑'],
  level: 4,
  ap: 4000,
  lp: 0,
  traits: ['YAIBA'],
  keywords: [],
  rarity: 'R',
  imageUrl: '1754284680625000.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/10-action-event.md',
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/20-color-and-switch.md',
  ],
};
