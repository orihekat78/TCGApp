// cards/ct-p08/B08027 長門秀臣 (キャラ) — engine拡張 wave#2 cluster4 (remove-area → deck-bottom, 2026-06-14)
// rules: 14-refresh.md, 15-abilities-effects.md, 17-icons.md, 26-qa-deck-refresh.md
//
// 公式テキスト:
//   【登場時】このキャラをリムーブしてもよい。そうした場合、自分と相手はリムーブエリアにあるすべての
//     カードをデッキの下に移し、デッキをシャッフルする。
//
// 句マッピング:
//   a1: 【登場時】 => trigger{hook:'enter', selfOnly:true}。
//       「このキャラをリムーブしてもよい。そうした場合、…」=> optional{ sequence[ sceneRemove $self, … ] }
//         (B09084 a2 同型。"してもよい"=optional / "そうした場合"=リムーブを選んだときのみ後続を実行 →
//          declined optional は __chainStepNoApply を立てないため chain ではなく optional(sequence) で表現:
//          受諾なら両 step 実行 / 拒否なら何もしない = 公式テキストの 2 分岐と等価)。
//       「自分と相手はリムーブエリアにあるすべてのカードをデッキの下に移し、デッキをシャッフルする」=>
//         removeAreaAllToDeckBottom (cluster4 新 verb。両プレイヤーの remove 全部を各自 deck 下へ + 両者 shuffle)。
//       公式Q&A: リムーブしたこのキャラ自身も移すカードに「含まれる」 => sceneRemove($self) が先に self.remove へ
//         push してから verb が drain するため自然に含まれる (sequence 順)。効果で登場したイベントカードも
//         先に remove に置かれてから【登場時】解決のため含まれる (engine が既に remove へ配置済)。
//       公式Q&A: この効果は「リフレッシュ」ではない (証拠付与なし) => verb は mutate.deck.refresh を呼ばず
//         raw splice + toBottom + shuffle のみ (rules/14/26)。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'enter', selfOnly: true }, // 【登場時】
  // このキャラをリムーブしてもよい。そうした場合、自分と相手のリムーブ全部をデッキ下へ + 両者シャッフル
  effect: {
    kind: 'optional',
    effect: {
      kind: 'sequence',
      steps: [
        // このキャラをリムーブ (自身を remove へ → 続く verb の drain 対象に含まれる)
        { kind: 'atom', verb: 'sceneRemove', args: { uid: '$self', cause: 'effect' } },
        // 自分と相手はリムーブエリアのすべてをデッキの下へ移し、デッキをシャッフル
        { kind: 'atom', verb: 'removeAreaAllToDeckBottom', args: {} },
      ],
    },
  },
  description:
    '【登場時】このキャラをリムーブしてもよい。そうした場合、自分と相手はリムーブエリアにあるすべてのカードをデッキの下に移し、デッキをシャッフルする。',
  ruleRefs: ['rules/14-refresh.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/26-qa-deck-refresh.md'],
};

export const B08027: CardDef = {
  id: 'B08027',
  no: '0867/B08027',
  kind: 'character',
  names: ['長門秀臣'],
  colors: ['緑'],
  level: 3,
  ap: 3000,
  lp: 1,
  traits: ['小説家'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1770731222507540.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/26-qa-deck-refresh.md',
  ],
};
