// cards/ct-p04/B04074 降谷零 (character) — engine mega-wave W5 exemplar (r47 levelInBound, 2026-07-03)
// rules: 13-keywords.md (捜査X), 15-abilities-effects.md, 17-icons.md, 21-declared-ability-cost.md,
//        25-qa-effects-resolution.md (即時解決「代わりに」)
//
// 公式テキスト:
//   【パートナー黄】【宣言】【ターン1】【スリープ】：〚捜査2〛（相手はデッキのカードを上から指定の数だけ
//     公開し、好きな順番でデッキの下に移す）する。自分の現場に〚カード名［風見裕也］〛がいる場合、
//     代わりに〚捜査4〛する。発見されたカードのいずれかと同じレベルのキャラを1枚まで選び、リムーブする。
//
// 句マッピング:
//   a1: 【パートナー黄】=> condition{kind:'partnerColor', color:'黄'} / 【宣言】=> type:'declared' /
//       【ターン1】=> limit{kind:'turn', n:1} / 【スリープ】=> cost{kind:'sleepSelf'}。
//       「〚捜査2〛する。…〚カード名[風見裕也]〛がいる場合、代わりに〚捜査4〛する」=>
//         chain step1 conditional{if:{kind:'bond', cardName:'風見裕也'}, then: souza x4, else: souza x2}
//         (「代わりに」= 択一 rules/25 即時解決。bond = 自分の現場に指定名 rules/17、パートナー不可。
//          解決時点の盤面で判定 rules/25。souza+bind = wave-0629d 出荷済、B03084 '$found' 同型)。
//       「発見されたカードのいずれかと同じレベルのキャラを1枚まで選び、リムーブする」=>
//         chain step2 sceneRemove{player:'self', max:1, side:'either',
//         filter:{kind:'character', levelIn 経由: levelInBound:{bindKey:'$found'}}} (mega-wave W5 r47。
//         「いずれかと同じレベル」= bound 集合の printed level any-match / 「1枚まで」= max:1 で 0枚可
//         公式Q&A / エリア無指定「キャラ」= side:'either' rules/15 / level は盤面キャラ側が実効値・
//         発見カード側が printed 値)。⚠ chain 必須: step2 の PA 短縮形 pick が dispatch 時に
//         candidates() で bindings['$found'] を読む (sequence の eager pre-walk では bind 未確定)。
//       公式Q&A「相手デッキが捜査数以下 → 残り全部公開、リフレッシュしない」= atomSouza 既存挙動
//       (deck から splice→bottom、リムーブ経路なし = refresh 経路そのものが無い)。
//   [hira/cutIn/henso col] 空 → 未カバー句なし。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'declared',
  scope: 'on-scene',
  condition: { kind: 'partnerColor', color: '黄' },
  limit: { kind: 'turn', n: 1 },
  cost: { kind: 'sleepSelf' },
  effect: {
    kind: 'chain',
    steps: [
      // 〚捜査2〛する。自分の現場に〚カード名[風見裕也]〛がいる場合、代わりに〚捜査4〛する
      {
        kind: 'conditional',
        if: { kind: 'bond', cardName: '風見裕也' },
        then: { kind: 'atom', verb: 'souza', args: { player: 'opp', x: 4, bind: '$found' } },
        else: { kind: 'atom', verb: 'souza', args: { player: 'opp', x: 2, bind: '$found' } },
      },
      // 発見されたカードのいずれかと同じレベルのキャラを1枚まで選び、リムーブする
      { kind: 'atom', verb: 'sceneRemove', args: { player: 'self', max: 1, side: 'either', filter: { kind: 'character', levelInBound: { bindKey: '$found' } } } },
    ],
  },
  description: '【パートナー黄】【宣言】【ターン1】【スリープ】：〚捜査2〛する。自分の現場に〚カード名［風見裕也］〛がいる場合、代わりに〚捜査4〛する。発見されたカードのいずれかと同じレベルのキャラを1枚まで選び、リムーブする。',
  ruleRefs: ['rules/13-keywords.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/21-declared-ability-cost.md', 'rules/25-qa-effects-resolution.md'],
};

export const B04074: CardDef = {
  id: 'B04074',
  no: '0460/B04074',
  kind: 'character',
  names: ['降谷零'],
  colors: ['黄'],
  level: 7,
  ap: 6000,
  lp: 1,
  traits: ['警察', '公安'],
  keywords: [],
  rarity: 'R',
  imageUrl: '1735287822616992.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md',
    'rules/25-qa-effects-resolution.md',
  ],
};
