// cards/ct-p09/B09104 ラム (キャラ) — engine拡張 wave#2 cluster2 (2026-06-12)
// rules: 13-keywords.md, 14-refresh.md, 15-abilities-effects.md, 17-icons.md, 26-qa-deck-refresh.md
//
// 公式テキスト (ct-p09/character.tsv):
//   【登場時】このキャラ以外の【現場リムーブ時】を持つキャラを1枚まで選び、
//     ターン終了時まで〚突撃〛（名乗り状態でもアクションできる）を与える。
//   【相手ターン中】【現場リムーブ時】相手のデッキのカードを上から4枚リムーブしてもよい。
//
// 句マッピング:
//   - 【登場時】 => a1 trigger:{hook:'enter', selfOnly:true}
//   - このキャラ以外の【現場リムーブ時】を持つキャラを1枚まで選び =>
//       charGrantKeyword の target pick query{area:'scene', side:'either', filter:{keyword:'現場リムーブ時', kind:'character'}, excludeSelf:true}, n{min:0,max:1}
//       ※ ability-presence filter は印字静的判定 (有効/発動可否は問わない — 公式Q&A「有効かどうかにかかわらず…選ぶことができます」)
//       ※ side:'either' — 公式テキストに「自分の現場」の限定語なし (rules/15 量化子)。qAndA の設問文は「自分の現場にいる…」だが
//          設問特定の言い回しであり、テキスト本文は両現場を許す解釈 (engine-wave2-ability-filter-design.md §B09104)
//   - ターン終了時まで〚突撃〛を与える => kw:'突撃', scope:'turn' (uid:'$pick' = 選んだキャラへ付与)
//   - 「1枚まで」=0枚可 (rules/15) / 一致0件なら付与なしで続行
//   - a2: 【相手ターン中】【現場リムーブ時】(condition turn:opp + trigger leave:to-remove selfOnly) =>
//       相手デッキ上4枚リムーブ「してもよい」= optional{mill{player:'opp', n:4}} (デッキ<4 は可能な限り→refresh、残りはリムーブしない — 公式Q&A / rules/14・26)

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  // 【登場時】
  trigger: { hook: 'enter', selfOnly: true },
  // このキャラ以外の【現場リムーブ時】を持つキャラを1枚まで選び、ターン終了時まで〚突撃〛を与える
  effect: {
    kind: 'atom',
    verb: 'charGrantKeyword',
    args: {
      uid: '$pick',
      kw: '突撃',
      scope: 'turn',
      target: {
        kind: 'pick',
        query: { area: 'scene', side: 'either', filter: { keyword: '現場リムーブ時', kind: 'character' }, excludeSelf: true },
        n: { min: 0, max: 1 },
        chooser: 'self',
      },
    },
  },
  description:
    '【登場時】このキャラ以外の【現場リムーブ時】を持つキャラを1枚まで選び、ターン終了時まで〚突撃〛（名乗り状態でもアクションできる）を与える。',
  ruleRefs: ['rules/13-keywords.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-scene',
  // 【現場リムーブ時】(このキャラ自身がリムーブされたとき)
  trigger: { hook: 'leave:to-remove', selfOnly: true },
  // 【相手ターン中】
  condition: { kind: 'turn', player: 'opp' },
  // 相手のデッキのカードを上から4枚リムーブしてもよい (任意効果 rules/15。デッキ<4 は可能な限り→refresh)
  effect: {
    kind: 'optional',
    effect: { kind: 'atom', verb: 'mill', args: { player: 'opp', n: 4 } },
  },
  description: '【相手ターン中】【現場リムーブ時】相手のデッキのカードを上から4枚リムーブしてもよい。',
  ruleRefs: ['rules/14-refresh.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/26-qa-deck-refresh.md'],
};

export const B09104: CardDef = {
  id: 'B09104',
  no: '1043/B09104',
  kind: 'character',
  names: ['ラム'],
  colors: ['黒'],
  level: 6,
  ap: 5000,
  lp: 1,
  traits: ['黒ずくめの組織'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1775608943963191.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/13-keywords.md',
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/26-qa-deck-refresh.md',
  ],
};
