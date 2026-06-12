// cards/ct-p03/B03131 ラム (character) — wave#2 cluster cutin-subtype filter (2026-06-12)
// rules: 13-keywords.md, 15-abilities-effects.md, 17-icons.md, 20-color-and-switch.md, 21-declared-ability-cost.md, 10-action-event.md
//
// 公式テキスト (TSV ct-p03/character.tsv 0380/B03131、qAndA なし):
//   【宣言】【ターン1】自分の現場にいる【カットイン】を持つ【黒】のキャラを1枚まで選び、
//     ターン終了時まで〚突撃〛（登場したターンからすぐにアクションできる）を与える。
//   【ヒラメキ】（証拠からリムーブされるときに発動する）カードを1枚引く。
//
// 句マッピング:
//   - 【宣言】【ターン1】 => type:'declared' (コスト無し — 宣言 no-cost exemplar: ct-p09/B09021 a2) + limit:{kind:'turn',n:1}
//   - 「自分の現場にいる【カットイン】を持つ【黒】のキャラを1枚まで選び」+「ターン終了時まで〚突撃〛を与える」 =>
//     charGrantKeyword 短縮形 PA carrier {player:'self', max:1, side:'self', filter:{keyword:'カットイン', color:'黒'}, kw:'突撃', scope:'turn'}
//     (exemplar: ct-p09/B09032 a1 — 短縮形 carrier {player,max,side,filter,kw,scope}。明示 uid:'$pick'+target carrier は human 経路で bind 喪失するため短縮形が必須)
//     ・filter.keyword:'カットイン' = 【カットイン】を持つ印字判定 (read/keyword.ts 経由。本 wave で matchOneFilter に keyword filter 追加済。
//       「持つ」= presence は印字静的判定 — 条件アイコンの有効性は問わない、公式Q&A 8件)
//     ・filter.color:'黒' = 【黒】のキャラ。kind は scene pick につき自明にキャラのみ (sceneは character のみ列挙)
//     ・side:'self' = 自分の現場にいる。max:1 + 「1枚まで」=0枚選択可 (rules/15)。「このキャラ以外」句なし → 自己も候補だがラム自身はカットイン非所持で実質除外
//     ・kw:'突撃' = 〚突撃〛(半角・ブラケット無し、exemplar 各種と一致)。scope:'turn' = ターン終了時まで
//   - 【ヒラメキ】（証拠からリムーブされるときに発動する）カードを1枚引く =>
//     type:'triggered', scope:'on-evidence', trigger{hook:'evidence:remove-by-action', optional:true}, effect: draw 1
//     (exemplar: ct-d05/D05007 a2 の triggered/on-evidence/evidence:remove-by-action 構造で effect だけ draw1)

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'declared',
  scope: 'on-scene',
  limit: { kind: 'turn', n: 1 }, // 【ターン1】
  // 自分の現場にいる【カットイン】を持つ【黒】のキャラを1枚まで選び、ターン終了時まで〚突撃〛を与える
  // (短縮形 PA carrier。0枚選択可 / カットイン印字 + 黒色の AND filter)
  effect: {
    kind: 'atom',
    verb: 'charGrantKeyword',
    args: { player: 'self', max: 1, side: 'self', filter: { keyword: 'カットイン', color: '黒' }, kw: '突撃', scope: 'turn' },
  },
  description:
    '【宣言】【ターン1】自分の現場にいる【カットイン】を持つ【黒】のキャラを1枚まで選び、ターン終了時まで〚突撃〛（登場したターンからすぐにアクションできる）を与える。',
  ruleRefs: ['rules/13-keywords.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/21-declared-ability-cost.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-evidence',
  // 【ヒラメキ】（証拠からリムーブされるときに発動する）
  trigger: { hook: 'evidence:remove-by-action', optional: true },
  // カードを1枚引く
  effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
  description: '【ヒラメキ】（証拠からリムーブされるときに発動する）カードを1枚引く。',
  ruleRefs: ['rules/10-action-event.md'],
};

export const B03131: CardDef = {
  id: 'B03131',
  no: '0380/B03131',
  kind: 'character',
  names: ['ラム'],
  colors: ['黒'],
  level: 7,
  ap: 6000,
  lp: 1,
  traits: ['黒ずくめの組織'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1729133510429592.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/10-action-event.md',
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/20-color-and-switch.md',
    'rules/21-declared-ability-cost.md',
  ],
};
