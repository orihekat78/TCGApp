// cards/ct-p06/B06017 天草四郎時定 (character) — engine拡張 wave (evidence-flip-facedown 有効化, 2026-06-23)
// rules: rules/03-field-areas.md, rules/09-cutin-disguise.md, rules/10-action-event.md, rules/14-refresh.md, rules/15-abilities-effects.md, rules/17-icons.md
//
// 公式テキスト:
//   【登場時】自分の現場にこのキャラ以外の〚特徴［YAIBA］〛のキャラがいる場合、カードを1枚引く。
//   【ヒラメキ】（証拠からリムーブされるときに発動する）自分の表向きの証拠を1つまで選び、裏向きにする。
//   【変装】【事件YAIBA】【FILE5】（コンタクト中のキャラと入れ替わって手札から出る。入れ替わったキャラはデッキの下に移す）
//
// 句マッピング:
//   - 【登場時】 => a1 trigger {hook:'enter', selfOnly:true} (B02077.ts a1 同型)
//   - 自分の現場にこのキャラ以外の〚特徴YAIBA〛がいる場合、カードを1枚引く =>
//     a1.effect conditional{ if: sceneHas{query:{area:'scene',side:'self',filter:{trait:'YAIBA',kind:'character'},excludeSelf:true},nMin:1}, then: draw{n:1} }
//     (B02077.ts a1 = 同パターン「現場にこのキャラ以外の〚trait〛がいる場合」= sceneHas+excludeSelf。
//      excludeSelf=このキャラ自身を計数除外、candidates.ts:205 cand.uid===ctx.source.uid 除外)。
//   - 【ヒラメキ】自分の表向きの証拠を1つまで選び、裏向きにする => a2 {type:'triggered', scope:'on-evidence',
//     trigger:{hook:'evidence:remove-by-action', optional:true}} + atom evidenceFlipDown 短縮形
//     {player:'self', max:1, faceUp:true} (engine拡張 wave 2026-06-23、B05013.ts a2 と同型)。
//   - 【変装】【事件YAIBA】【FILE5】 => a3 {type:'icon-disguise', condition:and[caseTrait YAIBA, fileAtLeast 5]}
//     (B02038.ts a3 = 同パターン【変装】【事件白】【FILE6】= and[caseColor, fileAtLeast]。本カードは
//      事件特徴 YAIBA ゆえ caseColor→caseTrait{trait:'YAIBA'} (BUG-124 caseTraits+traits union、B06050.ts:41 実証)。
//      変装時効果の印字なし=icon-disguise 単体 (disguise:into ability 無)。FILE5=fileAtLeast n:5)。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'enter', selfOnly: true }, // 【登場時】
  // 自分の現場にこのキャラ以外の〚特徴YAIBA〛がいる場合、カードを1枚引く
  effect: {
    kind: 'conditional',
    if: {
      kind: 'sceneHas',
      query: { area: 'scene', side: 'self', filter: { trait: 'YAIBA', kind: 'character' }, excludeSelf: true },
      nMin: 1,
    },
    then: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
  },
  description: '【登場時】自分の現場にこのキャラ以外の〚特徴［YAIBA］〛のキャラがいる場合、カードを1枚引く。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md'],
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

const a3: AbilityDef = {
  id: 'a3',
  type: 'icon-disguise',
  // 【事件YAIBA】【FILE5】（変装ゲート条件）
  condition: {
    kind: 'and',
    cs: [
      { kind: 'caseTrait', trait: 'YAIBA' },
      { kind: 'fileAtLeast', n: 5 },
    ],
  },
  description: '【変装】【事件YAIBA】【FILE5】（コンタクト中のキャラと入れ替わって手札から出る。入れ替わったキャラはデッキの下に移す）',
  ruleRefs: ['rules/09-cutin-disguise.md', 'rules/17-icons.md'],
};

export const B06017: CardDef = {
  id: 'B06017',
  no: '0640/B06017',
  kind: 'character',
  names: ['天草四郎時定'],
  colors: ['緑'],
  level: 5,
  ap: 5000,
  lp: 1,
  traits: ['YAIBA'],
  keywords: [],
  rarity: 'R',
  imageUrl: '1754284680614033.jpg',
  abilities: [a1, a2, a3],
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/09-cutin-disguise.md',
    'rules/10-action-event.md',
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
  ],
};
