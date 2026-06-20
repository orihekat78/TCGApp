// cards/ct-p08/B08067 諸伏高明 (キャラ) — distinct-name-count micro-cluster (2026-06-21)
// rules: 15-abilities-effects.md (「〜の場合」conditional), 17-icons.md (§条件アイコン),
//        19-special-rules.md (カード名), 07-action-flow.md (effect removal は state 不問)
//
// 公式テキスト:
//   【パートナー黄】【解決編】【登場時】自分の現場にそれぞれカード名の異なる〚特徴［長野県警］〛のキャラが
//     3枚以上いる場合、レベル7以下のキャラを1枚まで選び、リムーブする。
//
// a1: triggered【登場時】(enter selfOnly)。可用性 = 【パートナー黄】+【解決編】= ability.condition (and)。
//     「3枚以上いる場合」= 解決時評価の effect conditional (rules/15、exemplar D08003 a2)。distinct 計数は
//     sceneHas query.distinctNames=true (同名 print は1計数、自己包含=qAndA「このキャラ自身も数える」)。
//     then: レベル7以下のキャラ (どちらの現場でも=side either、effect removal は state 不問) を1枚まで選びリムーブ
//     (exemplar PR101 a1 step2 の sceneRemove 形)。
import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  // 【パートナー黄】【解決編】
  condition: { kind: 'and', cs: [{ kind: 'partnerColor', color: '黄' }, { kind: 'caseStatus', status: '解決編' }] },
  // 【登場時】
  trigger: { hook: 'enter', selfOnly: true },
  effect: {
    kind: 'conditional',
    // 自分の現場にそれぞれカード名の異なる[長野県警]が3枚以上いる場合
    if: { kind: 'sceneHas', query: { area: 'scene', side: 'self', filter: { trait: '長野県警' }, distinctNames: true }, nMin: 3 },
    // レベル7以下のキャラを1枚まで選び、リムーブする
    then: { kind: 'atom', verb: 'sceneRemove', args: { player: 'self', max: 1, side: 'either', filter: { levelMax: 7 } } },
  },
  description: '【パートナー黄】【解決編】【登場時】現場のカード名の異なる[長野県警]3枚以上で、レベル7以下のキャラを1枚までリムーブ。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/19-special-rules.md'],
};

export const B08067: CardDef = {
  id: 'B08067',
  no: '0904/B08067',
  kind: 'character',
  names: ['諸伏高明'],
  colors: ['黄'],
  level: 5,
  ap: 4000,
  lp: 1,
  traits: ['警察', '長野県警'],
  keywords: [],
  rarity: 'R',
  imageUrl: '1770731238728402.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/19-special-rules.md',
  ],
};
