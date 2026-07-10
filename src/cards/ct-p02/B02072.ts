// cards/ct-p02/B02072 降谷零 (character) — S2 deck cluster (souza dyn X + levelSum 閾値, 2026-07-10)
// rules: 13-keywords.md (捜査X), 15-abilities-effects.md, 17-icons.md, 19-special-rules.md (レベル下限なし),
//        21-declared-ability-cost.md, 26-qa-deck-refresh.md
//
// 公式テキスト:
//   【宣言】【ターン1】【スリープ】：〚捜査X〛（相手はデッキのカードを上から指定の数だけ公開し、
//     好きな順番でデッキの下に移す）する。Xは自分の現場にいる〚特徴［警察］〛のキャラの数に等しい。
//     発見されたカードのレベルの合計以下のレベルのキャラを1枚まで選び、リムーブする。
//
// 句マッピング (B04074 同キャラ双子の chain 骨格 re-mix):
//   a1: 【宣言】=> type:'declared' / 【ターン1】=> limit{turn,1} / 【スリープ】=> cost{sleepSelf}。
//       「捜査X…Xは自分の現場の[警察]の数」=> souza x:{dyn:'$self.sceneTrait.警察'}
//         (dyn/eval.ts sceneTrait — scene 在籍で計数、スリープ済の自身も含む = 公式Q&A「自身も数える」。
//          コスト解決後に dyn 評価されるが sleepSelf は scene を離れないため計数不変)。
//       「発見されたカードのレベルの合計以下のレベルのキャラを1枚まで選び、リムーブ」=>
//         sceneRemove{max:1, side:'either', filter:{kind:'character', levelMax:{dyn:'$bound.$found.levelSum'}}}
//         (levelSum = bound cardId の printed level 合計 (盤外 convention) / 盤面キャラ側は実効レベル比較。
//          「1枚まで」= 0枚可 rules/15 / エリア無指定 = side:'either' rules/15)。
//       ⚠ chain 必須 (B04074 同型): sequence の eager pre-walk では $found 未確定のまま
//         levelMax dyn が 0 で literal 化される。chain は dispatch 時に bindings を読む。
//       公式Q&A「Xを減らせない」= dyn 評価は宣言時 1 回で操作余地なし /
//       「デッキX枚未満 → 可能な限り公開・リフレッシュしない」= atomSouza 既存挙動 (rules/26 整合) /
//       「順番を相手に見せない」= souza の deck-bottom 移送は非公開 (UI 順序選択は deck 所有者のみ)。
//   [hira/cutIn/henso col] 空 → 未カバー句なし。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'declared',
  scope: 'on-scene',
  limit: { kind: 'turn', n: 1 },
  cost: { kind: 'sleepSelf' },
  effect: {
    kind: 'chain',
    steps: [
      // 〚捜査X〛— X = 自分の現場の特徴[警察] の数 (自身含む)
      { kind: 'atom', verb: 'souza', args: { player: 'opp', x: { dyn: '$self.sceneTrait.警察' }, bind: '$found' } },
      // 発見されたカードのレベルの合計以下のレベルのキャラを1枚まで選び、リムーブ
      { kind: 'atom', verb: 'sceneRemove', args: { player: 'self', max: 1, side: 'either', filter: { kind: 'character', levelMax: { dyn: '$bound.$found.levelSum' } } } },
    ],
  },
  description: '【宣言】【ターン1】【スリープ】：〚捜査X〛する。Xは自分の現場にいる〚特徴［警察］〛のキャラの数に等しい。発見されたカードのレベルの合計以下のレベルのキャラを1枚まで選び、リムーブする。',
  ruleRefs: ['rules/13-keywords.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/21-declared-ability-cost.md', 'rules/26-qa-deck-refresh.md'],
};

export const B02072: CardDef = {
  id: 'B02072',
  no: '0233/B02072',
  kind: 'character',
  names: ['降谷零'],
  colors: ['黄'],
  level: 8,
  ap: 8000,
  lp: 2,
  traits: ['警察', '公安'],
  keywords: [],
  rarity: 'SR',
  imageUrl: '1721357267367364.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md',
    'rules/26-qa-deck-refresh.md',
  ],
};
