// cards/ct-p05/B05013 灰原哀 (character) — engine拡張 wave (evidence-flip-facedown 有効化, 2026-06-23)
// rules: rules/03-field-areas.md, rules/10-action-event.md, rules/14-refresh.md, rules/15-abilities-effects.md, rules/17-icons.md
//
// 公式テキスト:
//   【登場時】自分の表向きの証拠を2つまで選び、裏向きにする。
//   【ヒラメキ】（証拠からリムーブされるときに発動する）自分の表向きの証拠を1つまで選び、裏向きにする。
//   Q&A: 表向きの証拠は好きな位置のものを選べる (順番は変えない)。
//
// 句マッピング:
//   - 【登場時】 => a1 trigger {hook:'enter', selfOnly:true} (自カードの登場で発火、B03076.ts a1 / B07064.ts a1 同型)
//   - 自分の表向きの証拠を2つまで選び、裏向きにする => atom evidenceFlipDown (engine拡張 wave 2026-06-23)。
//     「2つまで」= multi-pick → cardIds:'$pick.cardIds' 契約 (D08021 charStackCard 同型)。
//     query.faceUp:true = 表向きの証拠のみ候補化 (candidates.ts honor、裏向き除外)。n.max:2 / n.min:0 (「まで」= 0枚可, rules/15)。
//     side:'self'=自分の証拠 (Q&A「自分の表向きの証拠」)。順番不変は flipFaceDown が faceUp フラグのみ操作で保証。
//   - 【ヒラメキ】自分の表向きの証拠を1つまで選び、裏向きにする => a2 {type:'triggered', scope:'on-evidence',
//     trigger:{hook:'evidence:remove-by-action', optional:true}} + atom evidenceFlipDown 短縮形
//     {player:'self', max:1, faceUp:true} (max:1 = 0〜1「まで」/ pick-await は D08019.ts a2 ヒラメキ char-pick 同型の evidence 版)。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'enter', selfOnly: true }, // 【登場時】
  // 自分の表向きの証拠を2つまで選び、裏向きにする
  effect: {
    kind: 'atom',
    verb: 'evidenceFlipDown',
    args: {
      player: 'self',
      cardIds: '$pick.cardIds',
      target: {
        kind: 'pick',
        query: { area: 'evidence', side: 'self', faceUp: true },
        n: { min: 0, max: 2 },
        chooser: 'self',
      },
    },
  },
  description: '【登場時】自分の表向きの証拠を2つまで選び、裏向きにする。',
  ruleRefs: ['rules/03-field-areas.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md'],
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

export const B05013: CardDef = {
  id: 'B05013',
  no: '0519/B05013',
  kind: 'character',
  names: ['灰原哀'],
  colors: ['青'],
  level: 5,
  ap: 5000,
  lp: 1,
  traits: ['少年探偵団', '科学者'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1746628061722312.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/10-action-event.md',
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
  ],
};
