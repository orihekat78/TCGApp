// cards/ct-p07/B07064 ワトソン (character) — engine拡張 wave (evidence-flip-faceup 有効化, 2026-06-23)
// rules: rules/03-field-areas.md, rules/15-abilities-effects.md, rules/17-icons.md
//
// 公式テキスト:
//   【登場時】相手の裏向きの証拠を1つまで選び、表向きにする。
//
// 句マッピング:
//   - 【登場時】 => a1 trigger {hook:'enter', selfOnly:true} (自カードの登場で発火。
//     exemplar B01014.ts a1 / B07021.ts a2 VERBATIM。triggered.ts selfOnlyMatches: source.uid===card.uid)
//   - 相手の裏向きの証拠を1つまで選び、表向きにする => atom evidenceFlip
//     {player:'opp', max:1, faceDown:true} (engine拡張 wave 2026-06-23 で evidenceFlip に pick-form 追加)。
//     player:'opp'=相手の証拠 (= flipP=opp-of-owner)。chooser/picker は常に controller (ctx.source.player)。
//     max:1 = 0〜1 (「1つまで」= rules/15 §0枚可)。faceDown:true = 裏向き(未公開)の証拠のみ候補化
//     (既に表向きの証拠は除外、candidates.ts evidence case が honor)。短縮形 PB pick (evidenceToHand 同型)。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'enter', selfOnly: true }, // 【登場時】
  // 相手の裏向きの証拠を1つまで選び、表向きにする
  effect: { kind: 'atom', verb: 'evidenceFlip', args: { player: 'opp', max: 1, faceDown: true } },
  description: '【登場時】相手の裏向きの証拠を1つまで選び、表向きにする。',
  ruleRefs: ['rules/03-field-areas.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

export const B07064: CardDef = {
  id: 'B07064',
  no: '0793/B07064',
  kind: 'character',
  names: ['ワトソン'],
  colors: ['白'],
  level: 3,
  ap: 3000,
  lp: 0,
  traits: ['鷹'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1762414010641053.jpg',
  abilities: [a1],
  ruleRefs: ['rules/03-field-areas.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md'],
};
